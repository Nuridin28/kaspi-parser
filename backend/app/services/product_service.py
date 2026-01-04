from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from app.models.product import Product, Seller, Offer, PriceHistory
from app.models.job import ParsingJob, JobStatus
from app.core.redis_client import redis_client
from app.core.database import SessionLocal
from app.services.parser import KaspiAPIParser
from datetime import datetime
import asyncio
import hashlib


class ProductService:
    @staticmethod
    async def parse_and_save_product(url: str, job_id: Optional[int] = None, db: Optional[Session] = None) -> Product:
        if db is None:
            db = SessionLocal()
            should_close = True
        else:
            should_close = False
        
        try:
            if job_id:
                job = db.query(ParsingJob).filter(ParsingJob.id == job_id).first()
                if job:
                    job.status = JobStatus.PARSING
                    job.started_at = datetime.utcnow()
                    db.commit()
                    from app.api.v1.websocket import notify_job_status
                    await notify_job_status(job_id, "parsing", "Парсинг начат")
            
            from app.core.config import settings
            parser = KaspiAPIParser(
                top_n=settings.TOP_SELLERS_COUNT
            )
            data = await parser.parse_product(url)
            
            kaspi_id = data["kaspi_id"]
            
            product = db.query(Product).filter(Product.kaspi_id == kaspi_id).first()
            
            if not product:
                product = Product(
                    kaspi_id=kaspi_id,
                    name=data.get("name"),
                    category=data.get("category")
                )
                db.add(product)
                db.commit()
                db.refresh(product)
            
            product.name = data.get("name") or product.name
            product.category = data.get("category") or product.category
            product.updated_at = datetime.utcnow()
            
            parse_timestamp = datetime.utcnow()
            
            old_offers = db.query(Offer).filter(Offer.product_id == product.id).all()
            for old_offer in old_offers:
                price_history = PriceHistory(
                    product_id=product.id,
                    seller_id=old_offer.seller_id,
                    price=old_offer.price,
                    position=old_offer.position,
                    recorded_at=old_offer.parsed_at or parse_timestamp
                )
                db.add(price_history)
            
            db.query(Offer).filter(Offer.product_id == product.id).delete()
            
            top_offers = data["offers"][:10]
            
            for offer_data in top_offers:
                seller_name = offer_data["seller_name"]
                seller_kaspi_id = offer_data.get("seller_id")
                
                if not seller_kaspi_id:
                    seller_kaspi_id = hashlib.md5(seller_name.encode()).hexdigest()
                    print(f"Generated kaspi_id for seller {seller_name}: {seller_kaspi_id}")
                else:
                    seller_kaspi_id = str(seller_kaspi_id)
                
                seller = db.query(Seller).filter(
                    (Seller.kaspi_id == seller_kaspi_id) | (Seller.name == seller_name)
                ).first()
                
                if not seller:
                    seller = Seller(
                        kaspi_id=seller_kaspi_id,
                        name=seller_name,
                        rating=offer_data.get("rating"),
                        reviews_count=offer_data.get("reviews_count", 0)
                    )
                    db.add(seller)
                    db.commit()
                    db.refresh(seller)
                else:
                    if not seller.kaspi_id.startswith("seller_") and seller.kaspi_id != seller_kaspi_id:
                        print(f"Updating kaspi_id for existing seller {seller.name} from {seller.kaspi_id} to {seller_kaspi_id}")
                        seller.kaspi_id = seller_kaspi_id
                
                if offer_data.get("rating"):
                    seller.rating = offer_data["rating"]
                if offer_data.get("reviews_count"):
                    seller.reviews_count = offer_data["reviews_count"]
                
                offer = Offer(
                    product_id=product.id,
                    seller_id=seller.id,
                    price=offer_data["price"],
                    position=offer_data.get("position"),
                    in_stock=offer_data.get("in_stock", True),
                    parsed_at=parse_timestamp
                )
                db.add(offer)
                
                price_history_new = PriceHistory(
                    product_id=product.id,
                    seller_id=seller.id,
                    price=offer_data["price"],
                    position=offer_data.get("position"),
                    recorded_at=parse_timestamp
                )
                db.add(price_history_new)
            
            db.commit()
            
            offers_for_cache = [
                {
                    "price": o.price,
                    "seller_name": o.seller.name,
                    "seller_rating": o.seller.rating,
                    "seller_reviews_count": o.seller.reviews_count,
                    "position": o.position,
                    "in_stock": o.in_stock
                }
                for o in product.offers
            ]
            redis_client.set_product_offers(str(product.id), offers_for_cache)
            redis_client.set_price_buckets(str(product.id), data["price_buckets"])
            
            if job_id:
                job = db.query(ParsingJob).filter(ParsingJob.id == job_id).first()
                if job:
                    job.status = JobStatus.COMPLETED
                    job.kaspi_product_id = kaspi_id
                    job.completed_at = datetime.utcnow()
                    db.commit()
                    from app.api.v1.websocket import notify_job_status
                    await notify_job_status(job_id, "completed", "Парсинг завершен успешно")
            
            return product
            
        except Exception as e:
            db.rollback()
            if job_id:
                job = db.query(ParsingJob).filter(ParsingJob.id == job_id).first()
                if job:
                    job.status = JobStatus.FAILED
                    job.error_message = str(e)
                    job.completed_at = datetime.utcnow()
                    db.commit()
                    from app.api.v1.websocket import notify_job_status
                    await notify_job_status(job_id, "failed", f"Ошибка: {str(e)}")
            raise
        finally:
            if should_close:
                db.close()
    
    @staticmethod
    def get_product(db: Session, product_id: int) -> Optional[Product]:
        return db.query(Product).options(
            joinedload(Product.offers).joinedload(Offer.seller)
        ).filter(Product.id == product_id).first()
    
    @staticmethod
    def get_product_by_kaspi_id(db: Session, kaspi_id: str) -> Optional[Product]:
        return db.query(Product).options(
            joinedload(Product.offers).joinedload(Offer.seller)
        ).filter(Product.kaspi_id == kaspi_id).first()
    
    @staticmethod
    def list_products(db: Session, skip: int = 0, limit: int = 100, search: Optional[str] = None) -> List[Product]:
        query = db.query(Product).options(
            joinedload(Product.offers).joinedload(Offer.seller)
        )
        if search:
            query = query.filter(
                (Product.name.ilike(f"%{search}%")) | 
                (Product.category.ilike(f"%{search}%"))
            )
        return query.offset(skip).limit(limit).all()
