from app.core.database import SessionLocal
from app.models.product import Product, PriceHistory
from app.models.analytics import AnalyticsDaily
from app.services.analytics import AnalyticsService
from datetime import date, timedelta
from sqlalchemy import func

db = SessionLocal()

try:
    for product in db.query(Product).all():
        try:
            dates = db.query(func.date(PriceHistory.recorded_at)).filter(
                PriceHistory.product_id == product.id
            ).distinct().order_by(func.date(PriceHistory.recorded_at)).all()
            
            for (record_date,) in dates:
                history_records = db.query(PriceHistory).filter(
                    PriceHistory.product_id == product.id,
                    func.date(PriceHistory.recorded_at) == record_date
                ).all()
                
                if history_records:
                    offers_data = [{"price": r.price} for r in history_records]
                    stats = AnalyticsService.calculate_statistics(offers_data)
                    
                    if stats["min_price"] is None:
                        continue
                    
                    sorted_prices = sorted([r.price for r in history_records])
                    
                    price_pos_1 = sorted_prices[0] if sorted_prices else None
                    price_pos_3 = sorted_prices[2] if len(sorted_prices) > 2 else None
                    price_pos_5 = sorted_prices[4] if len(sorted_prices) > 4 else None
                    price_pos_10 = sorted_prices[9] if len(sorted_prices) > 9 else None
                    
                    previous_day = db.query(AnalyticsDaily).filter(
                        AnalyticsDaily.product_id == product.id,
                        AnalyticsDaily.date < record_date
                    ).order_by(AnalyticsDaily.date.desc()).first()
                    
                    delta_price = None
                    delta_percent = None
                    sellers_delta = 0
                    
                    if previous_day and previous_day.avg_price and stats["avg_price"]:
                        delta_price = stats["avg_price"] - previous_day.avg_price
                        delta_percent = (delta_price / previous_day.avg_price * 100) if previous_day.avg_price > 0 else 0
                    
                    current_sellers = len(set(r.seller_id for r in history_records))
                    if previous_day and previous_day.sellers_count:
                        sellers_delta = current_sellers - previous_day.sellers_count
                    
                    existing = db.query(AnalyticsDaily).filter(
                        AnalyticsDaily.product_id == product.id,
                        AnalyticsDaily.date == record_date
                    ).first()
                    
                    if not existing:
                        analytics = AnalyticsDaily(
                            product_id=product.id,
                            date=record_date,
                            min_price=stats["min_price"],
                            max_price=stats["max_price"],
                            avg_price=stats["avg_price"],
                            median_price=stats["median_price"],
                            price_std=stats["price_std"] or 0,
                            offers_count=len(history_records),
                            sellers_count=current_sellers,
                            top_sellers_count=len(history_records),
                            estimated_total_sellers=len(history_records) * 4,
                            price_position_1=price_pos_1,
                            price_position_3=price_pos_3,
                            price_position_5=price_pos_5,
                            price_position_10=price_pos_10,
                            avg_seller_rating=None,
                            in_stock_count=len(history_records),
                            delta_price=delta_price,
                            delta_percent=delta_percent,
                            sellers_delta=sellers_delta
                        )
                        db.add(analytics)
            
            db.commit()
            print(f"Processed product {product.id}")
        except Exception as e:
            print(f"Error processing product {product.id}: {e}")
            db.rollback()
            continue
except Exception as e:
    print(f"Error: {e}")
    db.rollback()
finally:
    db.close()

