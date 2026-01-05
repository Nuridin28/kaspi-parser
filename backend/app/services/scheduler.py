from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.services.product_service import ProductService
from app.models.product import Product, PriceHistory
from app.models.analytics import AnalyticsDaily
from app.models.scheduler import SchedulerConfig
from app.services.analytics import AnalyticsService
from app.core.redis_client import redis_client
from app.core.config import settings
from datetime import date, datetime, timedelta
import asyncio


scheduler = AsyncIOScheduler()


async def daily_price_update():
    db = SessionLocal()
    try:
        products = db.query(Product).all()
        updated_products = []
        
        for product in products:
            try:
                updated_product = await ProductService.parse_and_save_product(
                    f"https://kaspi.kz/shop/p/{product.kaspi_id}/", 
                    None, 
                    db
                )
                updated_products.append(updated_product.id)
            except Exception as e:
                print(f"Error updating product {product.id}: {e}")
                db.rollback()
                continue
        
        if updated_products:
            from app.api.v1.websocket import manager
            await manager.broadcast_to_all({
                "type": "products_updated",
                "product_ids": updated_products,
                "message": f"Обновлено {len(updated_products)} товаров"
            })
    finally:
        db.close()


async def daily_analytics_aggregation(target_date: date = None):
    db = SessionLocal()
    try:
        products = db.query(Product).all()
        today = target_date or date.today()
        
        for product in products:
            try:
                offers_data = redis_client.get_product_offers(str(product.id))
                if not offers_data:
                    offers_data = [
                        {
                            "price": o.price,
                            "position": o.position,
                            "in_stock": o.in_stock,
                            "seller_rating": o.seller.rating if o.seller else None,
                            "seller_name": o.seller.name if o.seller else ""
                        } for o in product.offers
                    ]
                
                if not offers_data:
                    continue
                
                stats = AnalyticsService.calculate_statistics(offers_data)
                buckets = redis_client.get_price_buckets(str(product.id))
                
                sorted_offers = sorted([o for o in offers_data if o.get("price")], key=lambda x: x.get("price", 0))
                
                price_pos_1 = sorted_offers[0]["price"] if sorted_offers else None
                price_pos_3 = sorted_offers[2]["price"] if len(sorted_offers) > 2 else None
                price_pos_5 = sorted_offers[4]["price"] if len(sorted_offers) > 4 else None
                price_pos_10 = sorted_offers[9]["price"] if len(sorted_offers) > 9 else None
                
                ratings = [o.get("seller_rating") for o in offers_data if o.get("seller_rating")]
                avg_rating = sum(ratings) / len(ratings) if ratings else None
                
                in_stock_count = sum(1 for o in offers_data if o.get("in_stock", True))
                
                previous_day = db.query(AnalyticsDaily).filter(
                    AnalyticsDaily.product_id == product.id,
                    AnalyticsDaily.date < today
                ).order_by(AnalyticsDaily.date.desc()).first()
                
                delta_price = None
                delta_percent = None
                sellers_delta = 0
                
                if previous_day and previous_day.avg_price and stats["avg_price"]:
                    delta_price = stats["avg_price"] - previous_day.avg_price
                    delta_percent = (delta_price / previous_day.avg_price * 100) if previous_day.avg_price > 0 else 0
                
                current_sellers = buckets.get("total_sellers_count") if buckets else len(offers_data)
                if previous_day and previous_day.sellers_count:
                    sellers_delta = current_sellers - previous_day.sellers_count
                
                existing = db.query(AnalyticsDaily).filter(
                    AnalyticsDaily.product_id == product.id,
                    AnalyticsDaily.date == today
                ).first()
                
                if existing:
                    existing.min_price = stats["min_price"]
                    existing.max_price = stats["max_price"]
                    existing.avg_price = stats["avg_price"]
                    existing.median_price = stats["median_price"]
                    existing.price_std = stats["price_std"] or 0
                    existing.offers_count = len(offers_data)
                    unique_sellers = len(set(o.get("seller_name", "") for o in offers_data if o.get("seller_name")))
                    existing.sellers_count = buckets.get("total_sellers_count") if buckets else (unique_sellers if unique_sellers > 0 else len(offers_data))
                    existing.top_sellers_count = buckets.get("top_sellers_count") if buckets else len(offers_data)
                    existing.estimated_total_sellers = buckets.get("total_sellers_count") if buckets else (len(offers_data) * 4)
                    existing.price_position_1 = price_pos_1
                    existing.price_position_3 = price_pos_3
                    existing.price_position_5 = price_pos_5
                    existing.price_position_10 = price_pos_10
                    existing.avg_seller_rating = avg_rating
                    existing.in_stock_count = in_stock_count
                    existing.delta_price = delta_price
                    existing.delta_percent = delta_percent
                    existing.sellers_delta = sellers_delta
                else:
                    analytics = AnalyticsDaily(
                        product_id=product.id,
                        date=today,
                        min_price=stats["min_price"],
                        max_price=stats["max_price"],
                        avg_price=stats["avg_price"],
                        median_price=stats["median_price"],
                        price_std=stats["price_std"] or 0,
                        offers_count=len(offers_data),
                        sellers_count=buckets.get("total_sellers_count") if buckets else (len(set(o.get("seller_name", "") for o in offers_data if o.get("seller_name"))) or len(offers_data)),
                        top_sellers_count=buckets.get("top_sellers_count") if buckets else len(offers_data),
                        estimated_total_sellers=buckets.get("total_sellers_count") if buckets else (len(offers_data) * 4),
                        price_position_1=price_pos_1,
                        price_position_3=price_pos_3,
                        price_position_5=price_pos_5,
                        price_position_10=price_pos_10,
                        avg_seller_rating=avg_rating,
                        in_stock_count=in_stock_count,
                        delta_price=delta_price,
                        delta_percent=delta_percent,
                        sellers_delta=sellers_delta
                    )
                    db.add(analytics)
                
                db.commit()
            except Exception as e:
                print(f"Error aggregating analytics for product {product.id}: {e}")
                db.rollback()
                continue
    finally:
        db.close()


def get_or_create_scheduler_config(db: Session, job_id: str) -> SchedulerConfig:
    config = db.query(SchedulerConfig).filter(SchedulerConfig.job_id == job_id).first()
    if not config:
        if job_id == "daily_price_update":
            config = SchedulerConfig(
                job_id=job_id,
                enabled=True,
                interval_hours=settings.PARSING_INTERVAL_HOURS,
                interval_minutes=settings.PARSING_INTERVAL_MINUTES
            )
        else:
            config = SchedulerConfig(
                job_id=job_id,
                enabled=True,
                cron_hour=3,
                cron_minute=0
            )
        db.add(config)
        db.commit()
        db.refresh(config)
    else:
        if config.cron_hour is not None and config.cron_hour > 23:
            config.cron_hour = 23
            db.commit()
        if config.cron_minute is not None and config.cron_minute > 59:
            config.cron_minute = 59
            db.commit()
    return config


def update_job_schedule(job_id: str, config: SchedulerConfig):
    if not config.enabled:
        try:
            scheduler.remove_job(job_id)
        except:
            pass
        return
    
    if job_id == "daily_price_update":
        if config.interval_hours or config.interval_minutes:
            total_minutes = (config.interval_hours * 60) + config.interval_minutes
            trigger = IntervalTrigger(minutes=total_minutes)
        elif config.cron_hour is not None and config.cron_minute is not None:
            cron_hour = min(config.cron_hour, 23)
            trigger = CronTrigger(hour=cron_hour, minute=config.cron_minute)
        else:
            trigger = IntervalTrigger(hours=24)
        
        scheduler.add_job(
            daily_price_update,
            trigger=trigger,
            id=job_id,
            replace_existing=True
        )
    elif job_id == "daily_analytics_aggregation":
        if config.cron_hour is not None and config.cron_minute is not None:
            cron_hour = min(config.cron_hour, 23)
            trigger = CronTrigger(hour=cron_hour, minute=config.cron_minute)
        else:
            trigger = CronTrigger(hour=3, minute=0)
        
        scheduler.add_job(
            daily_analytics_aggregation,
            trigger=trigger,
            id=job_id,
            replace_existing=True
        )


def start_scheduler():
    db = SessionLocal()
    try:
        price_config = get_or_create_scheduler_config(db, "daily_price_update")
        update_job_schedule("daily_price_update", price_config)
        
        analytics_config = get_or_create_scheduler_config(db, "daily_analytics_aggregation")
        update_job_schedule("daily_analytics_aggregation", analytics_config)
    finally:
        db.close()
    
    scheduler.start()
    print("Scheduler started")


def shutdown_scheduler():
    scheduler.shutdown()

