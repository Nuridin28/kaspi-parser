import redis
from app.core.config import settings
from typing import Optional, List, Dict
import json


class RedisClient:
    def __init__(self):
        self.client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    
    def get_product_offers(self, product_id: str) -> Optional[List[Dict]]:
        key = f"product:{product_id}:offers"
        data = self.client.get(key)
        if data:
            return json.loads(data)
        return None
    
    def set_product_offers(self, product_id: str, offers: List[Dict], ttl: int = None):
        key = f"product:{product_id}:offers"
        ttl = ttl or settings.REDIS_TTL
        self.client.setex(key, ttl, json.dumps(offers))
    
    def get_price_buckets(self, product_id: str) -> Optional[Dict]:
        key = f"product:{product_id}:buckets"
        data = self.client.get(key)
        if data:
            return json.loads(data)
        return None
    
    def set_price_buckets(self, product_id: str, buckets: Dict, ttl: int = None):
        key = f"product:{product_id}:buckets"
        ttl = ttl or settings.REDIS_TTL
        self.client.setex(key, ttl, json.dumps(buckets))
    
    def add_to_sorted_set(self, key: str, score: float, value: str):
        self.client.zadd(key, {value: score})
    
    def get_rank(self, key: str, value: str) -> Optional[int]:
        rank = self.client.zrank(key, value)
        return rank
    
    def get_sorted_set_range(self, key: str, start: int = 0, end: int = -1) -> List[tuple]:
        return self.client.zrange(key, start, end, withscores=True)
    
    def delete_key(self, key: str):
        self.client.delete(key)
    
    def set_job_status(self, job_id: str, status: str, data: Dict = None):
        key = f"job:{job_id}"
        value = {"status": status}
        if data:
            value.update(data)
        self.client.setex(key, 3600, json.dumps(value))
    
    def get_job_status(self, job_id: str) -> Optional[Dict]:
        key = f"job:{job_id}"
        data = self.client.get(key)
        if data:
            return json.loads(data)
        return None
    
    def set_all_prices(self, product_id: str, prices: List[float], ttl: int = None):
        key = f"product:{product_id}:all_prices"
        ttl = ttl or settings.REDIS_TTL
        self.client.setex(key, ttl, json.dumps(prices))
    
    def get_all_prices(self, product_id: str) -> Optional[List[float]]:
        key = f"product:{product_id}:all_prices"
        data = self.client.get(key)
        if data:
            return json.loads(data)
        return None


redis_client = RedisClient()

