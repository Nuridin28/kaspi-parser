from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class AnalyticsDaily(Base):
    __tablename__ = "analytics_daily"
    
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False, index=True)
    
    min_price = Column(Float)
    max_price = Column(Float)
    avg_price = Column(Float)
    median_price = Column(Float)
    price_std = Column(Float, default=0)
    
    offers_count = Column(Integer, default=0)
    sellers_count = Column(Integer, default=0)
    top_sellers_count = Column(Integer, default=0)
    estimated_total_sellers = Column(Integer, default=0)
    
    price_position_1 = Column(Float)
    price_position_3 = Column(Float)
    price_position_5 = Column(Float)
    price_position_10 = Column(Float)
    
    avg_seller_rating = Column(Float)
    in_stock_count = Column(Integer, default=0)
    
    delta_price = Column(Float)
    delta_percent = Column(Float)
    sellers_delta = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    product = relationship("Product")

