from pydantic import BaseModel, HttpUrl, Field, model_validator
from typing import List, Optional
from datetime import datetime


class OfferResponse(BaseModel):
    id: int
    price: float
    position: Optional[int]
    in_stock: bool
    seller_name: str
    seller_rating: Optional[float]
    seller_reviews_count: int
    parsed_at: datetime
    
    @model_validator(mode='before')
    @classmethod
    def extract_seller_data(cls, data):
        if hasattr(data, 'seller'):
            seller = data.seller
            return {
                'id': data.id,
                'price': data.price,
                'position': data.position,
                'in_stock': data.in_stock,
                'parsed_at': data.parsed_at,
                'seller_name': seller.name if seller else '',
                'seller_rating': seller.rating if seller else None,
                'seller_reviews_count': seller.reviews_count if seller else 0,
            }
        return data
    
    class Config:
        from_attributes = True


class ProductResponse(BaseModel):
    id: int
    kaspi_id: str
    name: Optional[str]
    category: Optional[str]
    offers: List[OfferResponse]
    created_at: datetime
    updated_at: Optional[datetime]
    last_parsed_at: Optional[datetime] = None
    total_offers_count: Optional[int] = None
    
    @model_validator(mode='after')
    def calculate_last_parsed(self):
        if self.offers and len(self.offers) > 0:
            self.offers.sort(key=lambda x: (x.position if x.position is not None else 999999, x.price))
            last_parsed = max(offer.parsed_at for offer in self.offers)
            self.last_parsed_at = last_parsed
        return self
    
    class Config:
        from_attributes = True


class ProductCreate(BaseModel):
    url: HttpUrl = Field(..., description="URL товара на Kaspi")
    
    @model_validator(mode='after')
    def validate_kaspi_url(self):
        url_str = str(self.url)
        if 'kaspi.kz' not in url_str:
            raise ValueError('URL must be from kaspi.kz domain')
        if '/shop/p/' not in url_str:
            raise ValueError('URL must be a product page from Kaspi')
        return self


class BulkProductCreate(BaseModel):
    urls: List[HttpUrl] = Field(..., description="Массив URL товаров")


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, description="Название товара")
    category: Optional[str] = Field(None, description="Категория товара")


class PriceBuckets(BaseModel):
    min_price: float
    max_price: float
    sellers_count: Optional[int]
    top_sellers_count: int

