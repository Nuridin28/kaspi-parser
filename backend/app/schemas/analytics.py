from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class PositionEstimate(BaseModel):
    user_price: float
    estimated_position: int
    total_sellers: int
    percentile: float


class AnalyticsResponse(BaseModel):
    product_id: int
    date: date
    
    min_price: Optional[float]
    max_price: Optional[float]
    avg_price: Optional[float]
    median_price: Optional[float]
    price_std: Optional[float]
    
    offers_count: Optional[int]
    sellers_count: Optional[int]
    top_sellers_count: Optional[int]
    estimated_total_sellers: Optional[int]
    
    price_position_1: Optional[float]
    price_position_3: Optional[float]
    price_position_5: Optional[float]
    price_position_10: Optional[float]
    
    avg_seller_rating: Optional[float]
    in_stock_count: Optional[int]
    
    delta_price: Optional[float]
    delta_percent: Optional[float]
    sellers_delta: Optional[int]
    
    price_buckets: Optional[dict]
    
    created_at: datetime
    
    class Config:
        from_attributes = True

