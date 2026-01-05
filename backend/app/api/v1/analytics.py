from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from app.core.database import get_db
from app.schemas.analytics import PositionEstimate, AnalyticsResponse
from app.services.analytics import AnalyticsService
from app.services.product_service import ProductService
from app.core.redis_client import redis_client
from app.models.analytics import AnalyticsDaily
from app.models.product import PriceHistory, Seller, Product, Offer
from app.models.job import ParsingJob, JobStatus
from datetime import date, datetime, timedelta
from typing import List, Optional
from sqlalchemy import func

router = APIRouter()


@router.post("/products/{product_id}/position", response_model=PositionEstimate)
async def estimate_position(
    product_id: int,
    user_price: float = Query(..., description="User price in KZT"),
    force_refresh: bool = Query(False, description="Force refresh cache"),
    db: Session = Depends(get_db)
):
    from app.services.position_service import PositionService
    
    product = ProductService.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    estimate = await PositionService.get_exact_position(
        product.kaspi_id,
        user_price,
        force_refresh
    )
    
    return estimate


@router.get("/products/{product_id}/statistics")
async def get_statistics(
    product_id: int,
    db: Session = Depends(get_db)
):
    product = ProductService.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    offers_data = redis_client.get_product_offers(str(product_id))
    
    if not offers_data:
        offers_data = [
            {
                "price": o.price,
                "seller_name": o.seller.name
            }
            for o in product.offers
        ]
    
    statistics = AnalyticsService.calculate_statistics(offers_data)
    
    buckets = redis_client.get_price_buckets(str(product_id))
    
    return {
        **statistics,
        "price_buckets": buckets,
        "offers_count": len(offers_data)
    }


@router.get("/products/{product_id}/analytics", response_model=AnalyticsResponse)
async def get_analytics(
    product_id: int,
    target_date: date = None,
    db: Session = Depends(get_db)
):
    product = ProductService.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    target_date = target_date or date.today()
    
    analytics = db.query(AnalyticsDaily).filter(
        AnalyticsDaily.product_id == product_id,
        AnalyticsDaily.date == target_date
    ).first()
    
    if not analytics:
        offers_data = redis_client.get_product_offers(str(product_id))
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
            raise HTTPException(status_code=404, detail="No offers data available")
        
        stats = AnalyticsService.calculate_statistics(offers_data)
        buckets = redis_client.get_price_buckets(str(product_id))
        
        sorted_offers = sorted([o for o in offers_data if o.get("price")], key=lambda x: x.get("price", 0))
        
        price_pos_1 = sorted_offers[0]["price"] if sorted_offers else None
        price_pos_3 = sorted_offers[2]["price"] if len(sorted_offers) > 2 else None
        price_pos_5 = sorted_offers[4]["price"] if len(sorted_offers) > 4 else None
        price_pos_10 = sorted_offers[9]["price"] if len(sorted_offers) > 9 else None
        
        ratings = [o.get("seller_rating") for o in offers_data if o.get("seller_rating")]
        avg_rating = sum(ratings) / len(ratings) if ratings else None
        
        in_stock_count = sum(1 for o in offers_data if o.get("in_stock", True))
        
        previous_day = db.query(AnalyticsDaily).filter(
            AnalyticsDaily.product_id == product_id,
            AnalyticsDaily.date < target_date
        ).order_by(AnalyticsDaily.date.desc()).first()
        
        delta_price = None
        delta_percent = None
        sellers_delta = 0
        
        if previous_day and previous_day.avg_price and stats["avg_price"]:
            delta_price = stats["avg_price"] - previous_day.avg_price
            delta_percent = (delta_price / previous_day.avg_price * 100) if previous_day.avg_price > 0 else 0
        
        unique_sellers = len(set(o.get("seller_name", "") for o in offers_data if o.get("seller_name")))
        current_sellers = buckets.get("total_sellers_count") if buckets else (unique_sellers if unique_sellers > 0 else len(offers_data))
        if previous_day and previous_day.sellers_count:
            sellers_delta = current_sellers - previous_day.sellers_count
        
        analytics = AnalyticsDaily(
            product_id=product_id,
            date=target_date,
            min_price=stats["min_price"],
            max_price=stats["max_price"],
            avg_price=stats["avg_price"],
            median_price=stats["median_price"],
            price_std=stats["price_std"] or 0,
            offers_count=len(offers_data),
            sellers_count=current_sellers,
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
        db.refresh(analytics)
    
    return analytics


@router.get("/products/{product_id}/price-history")
async def get_price_history(
    product_id: int,
    start_date: date = Query(..., description="Start date"),
    end_date: date = Query(..., description="End date"),
    db: Session = Depends(get_db)
):
    product = ProductService.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    start_datetime = datetime.combine(start_date, datetime.min.time())
    end_datetime = datetime.combine(end_date, datetime.max.time())
    
    history_records = db.query(PriceHistory).filter(
        and_(
            PriceHistory.product_id == product_id,
            PriceHistory.recorded_at >= start_datetime,
            PriceHistory.recorded_at <= end_datetime
        )
    ).order_by(PriceHistory.recorded_at).all()
    
    dates_data = {}
    for record in history_records:
        record_date = record.recorded_at.date()
        if record_date not in dates_data:
            dates_data[record_date] = []
        
        seller = db.query(Seller).filter(Seller.id == record.seller_id).first()
        dates_data[record_date].append({
            "seller_id": record.seller_id,
            "seller_name": seller.name if seller else "Unknown",
            "price": record.price,
            "position": record.position,
            "recorded_at": record.recorded_at.isoformat()
        })
    
    result = []
    for record_date, offers in dates_data.items():
        prices = [o["price"] for o in offers]
        result.append({
            "date": record_date.isoformat(),
            "offers": offers,
            "min_price": min(prices) if prices else None,
            "max_price": max(prices) if prices else None,
            "avg_price": sum(prices) / len(prices) if prices else None,
            "offers_count": len(offers)
        })
    
    return sorted(result, key=lambda x: x["date"])


@router.get("/products/{product_id}/price-comparison")
async def compare_prices(
    product_id: int,
    date1: date = Query(..., description="First date"),
    date2: date = Query(..., description="Second date"),
    db: Session = Depends(get_db)
):
    product = ProductService.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    def get_date_data(target_date: date):
        start_datetime = datetime.combine(target_date, datetime.min.time())
        end_datetime = datetime.combine(target_date, datetime.max.time())
        
        history_records = db.query(PriceHistory).filter(
            and_(
                PriceHistory.product_id == product_id,
                PriceHistory.recorded_at >= start_datetime,
                PriceHistory.recorded_at <= end_datetime
            )
        ).order_by(PriceHistory.recorded_at.desc()).all()
        
        if not history_records:
            return None
        
        latest_time = history_records[0].recorded_at
        latest_records = [r for r in history_records if r.recorded_at.date() == latest_time.date() and abs((r.recorded_at - latest_time).total_seconds()) < 3600]
        
        offers = []
        for record in latest_records:
            seller = db.query(Seller).filter(Seller.id == record.seller_id).first()
            offers.append({
                "seller_id": record.seller_id,
                "seller_name": seller.name if seller else "Unknown",
                "price": record.price,
                "position": record.position,
                "recorded_at": record.recorded_at.isoformat()
            })
        
        if not offers:
            return None
        
        prices = [o["price"] for o in offers]
        return {
            "date": target_date.isoformat(),
            "offers": sorted(offers, key=lambda x: x["price"]),
            "min_price": min(prices),
            "max_price": max(prices),
            "avg_price": sum(prices) / len(prices),
            "median_price": sorted(prices)[len(prices) // 2] if prices else None,
            "offers_count": len(offers),
            "recorded_at": latest_time.isoformat()
        }
    
    data1 = get_date_data(date1)
    data2 = get_date_data(date2)
    
    comparison = {
        "product_id": product_id,
        "product_name": product.name,
        "date1": data1,
        "date2": data2
    }
    
    if data1 and data2:
        comparison["price_change"] = {
            "min_change": data2["min_price"] - data1["min_price"],
            "max_change": data2["max_price"] - data1["max_price"],
            "avg_change": data2["avg_price"] - data1["avg_price"],
            "min_change_percent": ((data2["min_price"] - data1["min_price"]) / data1["min_price"] * 100) if data1["min_price"] > 0 else 0,
            "max_change_percent": ((data2["max_price"] - data1["max_price"]) / data1["max_price"] * 100) if data1["max_price"] > 0 else 0,
            "avg_change_percent": ((data2["avg_price"] - data1["avg_price"]) / data1["avg_price"] * 100) if data1["avg_price"] > 0 else 0
        }
    
    return comparison


@router.get("/products/{product_id}/advanced")
async def get_advanced_analytics(
    product_id: int,
    user_price: float = Query(None, description="User price for analysis"),
    db: Session = Depends(get_db)
):
    product = ProductService.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    offers_data = [
        {
            "price": o.price,
            "seller_name": o.seller.name,
            "seller_rating": o.seller.rating,
            "seller_reviews_count": o.seller.reviews_count,
            "position": o.position
        }
        for o in product.offers
    ]
    
    price_history_data = []
    cutoff_date = datetime.utcnow() - timedelta(days=90)
    from app.models.product import PriceHistory
    history = db.query(PriceHistory).filter(
        PriceHistory.product_id == product_id,
        PriceHistory.recorded_at >= cutoff_date
    ).order_by(PriceHistory.recorded_at).all()
    
    for record in history:
        seller = db.query(Seller).filter(Seller.id == record.seller_id).first()
        price_history_data.append({
            "date": record.recorded_at.date().isoformat(),
            "price": record.price,
            "position": record.position,
            "seller_name": seller.name if seller else "Unknown"
        })
    
    price_dist = AnalyticsService.calculate_price_distribution(offers_data)
    price_rank = AnalyticsService.calculate_price_rank(user_price, offers_data) if user_price else None
    elasticity = AnalyticsService.calculate_elasticity(price_history_data)
    weighted_rank = AnalyticsService.calculate_weighted_rank(offers_data, user_price)
    dominant_sellers = AnalyticsService.detect_dominant_sellers(offers_data, price_history_data)
    volatility = AnalyticsService.calculate_volatility(price_history_data)
    trend = AnalyticsService.detect_trend(price_history_data)
    demand_proxy = AnalyticsService.calculate_demand_proxy(offers_data, price_history_data)
    entry_barrier = AnalyticsService.calculate_entry_barrier(offers_data)
    optimal_price = AnalyticsService.calculate_optimal_price(offers_data)
    anomalies = AnalyticsService.detect_anomalies(price_history_data, offers_data)
    
    from app.services.ai_service import AIService
    print(f"Starting AI insights generation for product_id: {product_id}")
    try:
        ai_service = AIService()
        print(f"AI service initialized. Client exists: {ai_service.client is not None}")
        ai_insights = ai_service.generate_advanced_insights(
            product.name or f"Товар {product.kaspi_id}",
            price_dist or {},
            volatility or {},
            trend or {},
            demand_proxy or {},
            entry_barrier or {},
            optimal_price or {},
            anomalies or [],
            weighted_rank or {},
            dominant_sellers or [],
            user_price
        )
        print(f"AI insights generated: {len(ai_insights) if ai_insights else 0} characters")
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"ERROR generating AI insights: {str(e)}\n{error_trace}")
        ai_insights = f"Ошибка генерации AI инсайтов: {str(e)}"
    
    return {
        "product_id": product_id,
        "product_name": product.name,
        "price_distribution": price_dist,
        "price_rank": price_rank,
        "elasticity": elasticity,
        "weighted_rank": weighted_rank,
        "dominant_sellers": dominant_sellers[:10],
        "volatility": volatility,
        "trend": trend,
        "demand_proxy": demand_proxy,
        "entry_barrier": entry_barrier,
        "optimal_price": optimal_price,
        "anomalies": anomalies,
        "ai_insights": ai_insights
    }


@router.post("/products/{product_id}/scenario")
async def analyze_scenario(
    product_id: int,
    scenario_price: float = Query(..., description="Scenario price to analyze"),
    current_price: float = Query(..., description="Current price"),
    db: Session = Depends(get_db)
):
    product = ProductService.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    offers_data = [
        {
            "price": o.price,
            "seller_name": o.seller.name,
            "seller_rating": o.seller.rating,
            "seller_reviews_count": o.seller.reviews_count,
            "position": o.position
        }
        for o in product.offers
    ]
    
    stats = AnalyticsService.calculate_statistics(offers_data)
    position_est = AnalyticsService.calculate_position_estimate(str(product_id), scenario_price, offers_data)
    
    from app.services.ai_service import AIService
    ai_service = AIService()
    scenario_analysis = ai_service.generate_scenario_analysis(
        product.name or f"Товар {product.kaspi_id}",
        current_price,
        scenario_price,
        stats,
        {
            "estimated_position": position_est.estimated_position,
            "total_sellers": position_est.total_sellers,
            "percentile": position_est.percentile
        }
    )
    
    return {
        "scenario_price": scenario_price,
        "current_price": current_price,
        "estimated_position": position_est.estimated_position,
        "percentile": position_est.percentile,
        "price_change_percent": ((scenario_price - current_price) / current_price * 100) if current_price > 0 else 0,
        "analysis": scenario_analysis
    }


@router.get("/dashboard")
async def get_dashboard_metrics(
    db: Session = Depends(get_db)
):
    total_products = db.query(Product).count()
    
    active_threshold = datetime.utcnow() - timedelta(days=7)
    active_products = db.query(Product).join(
        Offer, Product.id == Offer.product_id
    ).filter(
        Offer.parsed_at >= active_threshold
    ).distinct().count()
    
    total_sellers = db.query(Seller).count()
    
    total_offers = db.query(Offer).count()
    
    avg_price_result = db.query(func.avg(Offer.price)).scalar()
    avg_price = float(avg_price_result) if avg_price_result else 0
    
    last_24h = datetime.utcnow() - timedelta(hours=24)
    jobs_last_24h = db.query(ParsingJob).filter(
        ParsingJob.created_at >= last_24h
    ).all()
    
    completed_jobs = sum(1 for job in jobs_last_24h if job.status == JobStatus.COMPLETED)
    failed_jobs = sum(1 for job in jobs_last_24h if job.status == JobStatus.FAILED)
    pending_jobs = sum(1 for job in jobs_last_24h if job.status == JobStatus.PARSING or job.status == JobStatus.PENDING)
    
    last_7_days = datetime.utcnow() - timedelta(days=7)
    jobs_by_day = db.query(
        func.date(ParsingJob.created_at).label('day'),
        func.count(ParsingJob.id).label('count')
    ).filter(
        ParsingJob.created_at >= last_7_days
    ).group_by(func.date(ParsingJob.created_at)).all()
    
    parsing_activity = [
        {
            "date": day.isoformat(),
            "count": count
        }
        for day, count in jobs_by_day
    ]
    
    products_with_history = db.query(Product).join(
        PriceHistory, Product.id == PriceHistory.product_id
    ).filter(
        PriceHistory.recorded_at >= last_7_days
    ).distinct().all()
    
    top_price_changes = []
    for product in products_with_history:
        history_records = db.query(PriceHistory).filter(
            PriceHistory.product_id == product.id,
            PriceHistory.recorded_at >= last_7_days
        ).order_by(PriceHistory.recorded_at).all()
        
        if not history_records:
            continue
        
        first_price = history_records[0].price
        last_price = history_records[-1].price
        
        if first_price == last_price:
            continue
        
        price_change = last_price - first_price
        price_change_percent = ((price_change / first_price) * 100) if first_price > 0 else 0
        
        top_price_changes.append({
            "product_id": product.id,
            "product_name": product.name or f"Товар #{product.kaspi_id}",
            "kaspi_id": product.kaspi_id,
            "first_price": float(first_price),
            "last_price": float(last_price),
            "price_change": float(price_change),
            "price_change_percent": float(price_change_percent),
            "first_date": history_records[0].recorded_at.isoformat(),
            "last_date": history_records[-1].recorded_at.isoformat()
        })
    
    top_price_changes.sort(key=lambda x: abs(x["price_change"]), reverse=True)
    top_price_changes = top_price_changes[:5]
    
    categories_count = db.query(
        Product.category,
        func.count(Product.id).label('count')
    ).filter(
        Product.category.isnot(None)
    ).group_by(Product.category).all()
    
    categories = [
        {"name": cat or "Без категории", "count": count}
        for cat, count in categories_count
    ]
    
    return {
        "overview": {
            "total_products": total_products,
            "active_products": active_products,
            "total_sellers": total_sellers,
            "total_offers": total_offers,
            "avg_price": round(avg_price, 2)
        },
        "parsing_stats": {
            "last_24h": {
                "total": len(jobs_last_24h),
                "completed": completed_jobs,
                "failed": failed_jobs,
                "pending": pending_jobs
            },
            "activity": parsing_activity
        },
        "top_price_changes": top_price_changes,
        "categories": categories
    }

