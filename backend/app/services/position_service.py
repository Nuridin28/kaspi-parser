from typing import Dict, List, Optional
from app.services.parser import KaspiAPIParser
from app.core.redis_client import redis_client
from app.schemas.analytics import PositionEstimate
import json
import hashlib
from datetime import datetime, timedelta


class PositionService:
    CACHE_TTL = 600
    
    @staticmethod
    async def get_exact_position(
        kaspi_id: str,
        user_price: float,
        force_refresh: bool = False
    ) -> PositionEstimate:
        cache_key = f"position:exact:{kaspi_id}"
        
        if not force_refresh:
            cached_data = redis_client.client.get(cache_key)
            if cached_data:
                cached = json.loads(cached_data)
                prices = cached.get("prices", [])
                total_sellers = cached.get("total_sellers", 0)
                
                if prices:
                    position = PositionService._calculate_position(prices, user_price, total_sellers)
                    return PositionEstimate(
                        user_price=user_price,
                        estimated_position=position["position"],
                        total_sellers=position["total_sellers"],
                        percentile=position["percentile"]
                    )
        
        parser = KaspiAPIParser(top_n=None)
        url = f"https://kaspi.kz/shop/p/{kaspi_id}/"
        
        try:
            data = await parser.parse_product(url)
            offers = data.get("offers", [])
            
            if not offers:
                return PositionEstimate(
                    user_price=user_price,
                    estimated_position=1,
                    total_sellers=1,
                    percentile=0
                )
            
            prices = sorted([offer["price"] for offer in offers if offer.get("price")])
            total_sellers = len(prices)
            
            position_data = PositionService._calculate_position(prices, user_price, total_sellers)
            
            cache_data = {
                "prices": prices,
                "total_sellers": total_sellers,
                "cached_at": datetime.utcnow().isoformat()
            }
            redis_client.client.setex(
                cache_key,
                PositionService.CACHE_TTL,
                json.dumps(cache_data)
            )
            
            return PositionEstimate(
                user_price=user_price,
                estimated_position=position_data["position"],
                total_sellers=position_data["total_sellers"],
                percentile=position_data["percentile"]
            )
        except Exception as e:
            return PositionEstimate(
                user_price=user_price,
                estimated_position=1,
                total_sellers=1,
                percentile=0
            )
    
    @staticmethod
    def _calculate_position(prices: List[float], user_price: float, total_sellers: int) -> Dict:
        if not prices:
            return {
                "position": 1,
                "total_sellers": 1,
                "percentile": 0
            }
        
        sorted_prices = sorted(prices)
        
        if user_price < sorted_prices[0]:
            position = 1
        elif user_price > sorted_prices[-1]:
            position = total_sellers + 1
        else:
            cheaper_count = sum(1 for price in sorted_prices if price < user_price)
            equal_count = sum(1 for price in sorted_prices if price == user_price)
            
            if equal_count > 0:
                position = cheaper_count + 1
            else:
                position = cheaper_count + 1
        
        percentile = ((total_sellers - position + 1) / total_sellers * 100) if total_sellers > 0 else 0
        percentile = max(0, min(100, percentile))
        
        return {
            "position": position,
            "total_sellers": total_sellers,
            "percentile": percentile
        }

