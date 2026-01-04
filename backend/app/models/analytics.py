from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class AnalyticsDaily(Base):
    __tablename__ = "analytics_daily"
    
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    date = Column(Date, nullable=False, index=True)
    
    min_price = Column(Float)
    max_price = Column(Float)
    avg_price = Column(Float)
    median_price = Column(Float)
    price_std = Column(Float)
    
    sellers_count = Column(Integer)
    top_sellers_count = Column(Integer)
    
    estimated_total_sellers = Column(Integer)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    product = relationship("Product")

