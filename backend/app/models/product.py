from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Product(Base):
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    kaspi_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String)
    category = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    offers = relationship("Offer", back_populates="product", cascade="all, delete-orphan")
    price_history = relationship("PriceHistory", back_populates="product", cascade="all, delete-orphan")


class Seller(Base):
    __tablename__ = "sellers"
    
    id = Column(Integer, primary_key=True, index=True)
    kaspi_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    rating = Column(Float)
    reviews_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    offers = relationship("Offer", back_populates="seller")


class Offer(Base):
    __tablename__ = "offers"
    
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    seller_id = Column(Integer, ForeignKey("sellers.id"), nullable=False)
    price = Column(Float, nullable=False)
    position = Column(Integer)
    in_stock = Column(Boolean, default=True)
    parsed_at = Column(DateTime(timezone=True), server_default=func.now())
    
    product = relationship("Product", back_populates="offers")
    seller = relationship("Seller", back_populates="offers")


class PriceHistory(Base):
    __tablename__ = "price_history"
    
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    seller_id = Column(Integer, ForeignKey("sellers.id"), nullable=False)
    price = Column(Float, nullable=False)
    position = Column(Integer)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())
    
    product = relationship("Product", back_populates="price_history")
    seller = relationship("Seller")

