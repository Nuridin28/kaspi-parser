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
    
    sellers_count: Optional[int]
    top_sellers_count: Optional[int]
    estimated_total_sellers: Optional[int]
    
    price_buckets: Optional[dict]
    
    created_at: datetime
    
    class Config:
        from_attributes = True

