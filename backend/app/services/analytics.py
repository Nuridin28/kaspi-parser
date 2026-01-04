from typing import List, Dict, Optional
from app.core.redis_client import redis_client
from app.schemas.analytics import PositionEstimate
import statistics
import math
from datetime import datetime, timedelta
from collections import defaultdict


class AnalyticsService:
    @staticmethod
    def calculate_position_estimate(
        product_id: str,
        user_price: float,
        offers: List[Dict]
    ) -> PositionEstimate:
        all_prices = redis_client.get_all_prices(product_id)
        
        if all_prices and len(all_prices) > 0:
            sorted_prices = sorted(all_prices)
            cheaper_count = sum(1 for price in sorted_prices if price < user_price)
            
            if user_price < sorted_prices[0]:
                position = 1
            elif user_price > sorted_prices[-1]:
                position = len(sorted_prices) + 1
            else:
                position = cheaper_count + 1
            
            buckets = redis_client.get_price_buckets(product_id)
            parsed_count = len(sorted_prices)
            
            if buckets and buckets.get("total_sellers_count"):
                total_sellers_from_api = int(buckets["total_sellers_count"])
                print(f"Position calculation: user_price={user_price}, position={position}, parsed_count={parsed_count}, total_sellers_from_api={total_sellers_from_api}")
                
                total_sellers = max(total_sellers_from_api, parsed_count, position)
            else:
                total_sellers = max(parsed_count, position)
                print(f"Position calculation: No total_sellers_count in buckets, using max(parsed_count={parsed_count}, position={position})")
            
            print(f"Final total_sellers: {total_sellers}")
            
            percentile = ((total_sellers - position + 1) / total_sellers * 100) if total_sellers > 0 else 0
            percentile = max(0, min(100, percentile))
            
            print(f"Final: position={position}, total_sellers={total_sellers}, percentile={percentile:.2f}%")
            
            return PositionEstimate(
                user_price=user_price,
                estimated_position=position,
                total_sellers=total_sellers,
                percentile=percentile
            )
        
        if not offers:
            return PositionEstimate(
                user_price=user_price,
                estimated_position=1,
                total_sellers=1,
                percentile=0
            )
        
        valid_offers = [o for o in offers if o.get("price") is not None]
        if not valid_offers:
            return PositionEstimate(
                user_price=user_price,
                estimated_position=1,
                total_sellers=1,
                percentile=0
            )
        
        sorted_offers = sorted(valid_offers, key=lambda x: x["price"])
        prices = [o["price"] for o in sorted_offers]
        min_price = prices[0]
        max_price = prices[-1]
        parsed_count = len(sorted_offers)
        
        buckets = redis_client.get_price_buckets(product_id)
        total_sellers = buckets.get("total_sellers_count") if buckets else None
        
        if not total_sellers or total_sellers < parsed_count:
            total_sellers = parsed_count * 4
        
        if user_price < min_price:
            position = 1
        elif user_price > max_price:
            price_range = max_price - min_price
            if price_range > 0:
                price_ratio = (user_price - max_price) / price_range
                additional_sellers = int(price_ratio * (total_sellers - parsed_count))
                position = min(parsed_count + additional_sellers + 1, total_sellers)
            else:
                position = total_sellers
        else:
            cheaper_count = sum(1 for price in prices if price < user_price)
            equal_count = sum(1 for price in prices if price == user_price)
            
            if equal_count > 0:
                position_in_parsed = cheaper_count + 1
            else:
                position_in_parsed = cheaper_count + 1
            
            if total_sellers > parsed_count:
                position_ratio = (position_in_parsed - 1) / parsed_count
                position = int(1 + position_ratio * (total_sellers - 1))
            else:
                position = position_in_parsed
        
        position = max(1, min(position, total_sellers))
        
        percentile = ((total_sellers - position + 1) / total_sellers * 100) if total_sellers > 0 else 0
        percentile = max(0, min(100, percentile))
        
        return PositionEstimate(
            user_price=user_price,
            estimated_position=position,
            total_sellers=total_sellers,
            percentile=percentile
        )
    
    @staticmethod
    def calculate_statistics(offers: List[Dict]) -> Dict:
        if not offers:
            return {
                "min_price": None,
                "max_price": None,
                "avg_price": None,
                "median_price": None,
                "price_std": None
            }
        
        prices = [o["price"] for o in offers if o.get("price")]
        
        if not prices:
            return {
                "min_price": None,
                "max_price": None,
                "avg_price": None,
                "median_price": None,
                "price_std": None
            }
        
        return {
            "min_price": min(prices),
            "max_price": max(prices),
            "avg_price": statistics.mean(prices),
            "median_price": statistics.median(prices),
            "price_std": statistics.stdev(prices) if len(prices) > 1 else 0
        }

    @staticmethod
    def calculate_price_distribution(offers: List[Dict]) -> Dict:
        if not offers:
            return {}
        
        prices = sorted([o["price"] for o in offers if o.get("price")])
        if not prices:
            return {}
        
        n = len(prices)
        return {
            "min": prices[0],
            "max": prices[-1],
            "median": prices[n // 2] if n > 0 else None,
            "p25": prices[int(n * 0.25)] if n > 0 else None,
            "p75": prices[int(n * 0.75)] if n > 0 else None,
            "iqr": prices[int(n * 0.75)] - prices[int(n * 0.25)] if n > 1 else 0,
            "mean": statistics.mean(prices),
            "std": statistics.stdev(prices) if n > 1 else 0
        }

    @staticmethod
    def calculate_price_rank(user_price: float, offers: List[Dict]) -> Dict:
        prices = sorted([o["price"] for o in offers if o.get("price")])
        if not prices:
            return {"rank": 1, "total": 1, "percentile": 0, "cheaper_count": 0, "expensive_count": 0}
        
        cheaper = sum(1 for p in prices if p < user_price)
        expensive = sum(1 for p in prices if p > user_price)
        equal = sum(1 for p in prices if p == user_price)
        
        rank = cheaper + 1
        total = len(prices)
        percentile = (cheaper / total * 100) if total > 0 else 0
        
        return {
            "rank": rank,
            "total": total,
            "percentile": percentile,
            "cheaper_count": cheaper,
            "expensive_count": expensive,
            "equal_count": equal
        }

    @staticmethod
    def calculate_elasticity(price_history: List[Dict], days: int = 14) -> Dict:
        if len(price_history) < 2:
            return {"elasticity": None, "sensitivity": None}
        
        recent = sorted(price_history[-days:], key=lambda x: x.get("date", ""))
        if len(recent) < 2:
            return {"elasticity": None, "sensitivity": None}
        
        prices = [r.get("price", 0) for r in recent]
        positions = [r.get("position", 0) for r in recent if r.get("position")]
        
        if not positions or len(positions) < 2:
            return {"elasticity": None, "sensitivity": None}
        
        price_changes = [prices[i] - prices[i-1] for i in range(1, len(prices))]
        position_changes = [positions[i] - positions[i-1] for i in range(1, len(positions))]
        
        avg_price_change = statistics.mean(price_changes) if price_changes else 0
        avg_position_change = statistics.mean(position_changes) if position_changes else 0
        
        if avg_price_change == 0:
            return {"elasticity": 0, "sensitivity": 0}
        
        elasticity = avg_position_change / avg_price_change if avg_price_change != 0 else 0
        
        return {
            "elasticity": elasticity,
            "sensitivity": abs(elasticity),
            "avg_price_change_per_unit": avg_price_change,
            "avg_position_change_per_unit": avg_position_change
        }

    @staticmethod
    def calculate_weighted_rank(offers: List[Dict], user_price: float = None, user_rating: float = None) -> Dict:
        if not offers:
            return {}
        
        w1, w2, w3 = 0.5, 0.3, 0.2
        
        scores = []
        for offer in offers:
            price = offer.get("price", 0)
            rating = offer.get("seller_rating", 0) or 0
            reviews = offer.get("seller_reviews_count", 0) or 0
            
            prices = sorted([o.get("price", 0) for o in offers])
            price_rank = prices.index(price) + 1 if price in prices else len(prices)
            
            normalized_price_rank = price_rank / len(prices) if prices else 0
            normalized_rating = (5 - rating) / 5 if rating > 0 else 1
            normalized_reviews = math.log(reviews + 1) / 10 if reviews > 0 else 0
            
            score = (
                normalized_price_rank * w1 +
                normalized_rating * w2 +
                normalized_reviews * w3
            )
            
            scores.append({
                "seller_name": offer.get("seller_name", ""),
                "price": price,
                "rating": rating,
                "reviews": reviews,
                "score": score,
                "price_rank": price_rank
            })
        
        scores.sort(key=lambda x: x["score"])
        
        user_score = None
        if user_price is not None:
            user_normalized_rank = 0.5
            user_normalized_rating = (5 - (user_rating or 3)) / 5
            user_score = user_normalized_rank * w1 + user_normalized_rating * w2
        
        return {
            "scores": scores,
            "user_score": user_score,
            "user_rank": None
        }

    @staticmethod
    def detect_dominant_sellers(offers: List[Dict], price_history: List[Dict] = None) -> List[Dict]:
        if not offers:
            return []
        
        seller_stats = defaultdict(lambda: {"count": 0, "top3_count": 0, "avg_position": 0, "positions": []})
        
        for offer in offers:
            seller_name = offer.get("seller_name", "")
            position = offer.get("position", 999)
            
            seller_stats[seller_name]["count"] += 1
            seller_stats[seller_name]["positions"].append(position)
            if position <= 3:
                seller_stats[seller_name]["top3_count"] += 1
        
        if price_history:
            for record in price_history:
                seller_name = record.get("seller_name", "")
                position = record.get("position", 999)
                seller_stats[seller_name]["positions"].append(position)
                if position <= 3:
                    seller_stats[seller_name]["top3_count"] += 1
        
        dominant = []
        for seller_name, stats in seller_stats.items():
            if stats["positions"]:
                avg_pos = statistics.mean(stats["positions"])
            else:
                avg_pos = 999
            
            dominant.append({
                "seller_name": seller_name,
                "frequency": stats["count"],
                "top3_frequency": stats["top3_count"],
                "avg_position": avg_pos,
                "dominance_score": stats["top3_count"] / max(len(offers), 1)
            })
        
        dominant.sort(key=lambda x: x["dominance_score"], reverse=True)
        return dominant[:10]

    @staticmethod
    def calculate_volatility(price_history: List[Dict]) -> Dict:
        if len(price_history) < 2:
            return {"volatility": None, "coefficient_of_variation": None, "price_range": None}
        
        prices = [r.get("price", 0) for r in price_history if r.get("price")]
        if not prices or len(prices) < 2:
            return {"volatility": None, "coefficient_of_variation": None, "price_range": None}
        
        std = statistics.stdev(prices)
        mean = statistics.mean(prices)
        cv = (std / mean * 100) if mean > 0 else 0
        price_range = max(prices) - min(prices)
        
        return {
            "volatility": std,
            "coefficient_of_variation": cv,
            "price_range": price_range,
            "min": min(prices),
            "max": max(prices),
            "mean": mean
        }

    @staticmethod
    def detect_trend(price_history: List[Dict], days: int = 14) -> Dict:
        if len(price_history) < 2:
            return {"trend": "insufficient_data", "slope": None, "direction": None}
        
        recent = sorted(price_history[-days:], key=lambda x: x.get("date", ""))
        if len(recent) < 2:
            return {"trend": "insufficient_data", "slope": None, "direction": None}
        
        prices = [r.get("price", 0) for r in recent]
        dates = [i for i in range(len(prices))]
        
        n = len(prices)
        sum_x = sum(dates)
        sum_y = sum(prices)
        sum_xy = sum(dates[i] * prices[i] for i in range(n))
        sum_x2 = sum(x * x for x in dates)
        
        slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x * sum_x) if (n * sum_x2 - sum_x * sum_x) != 0 else 0
        
        direction = "up" if slope > 0.1 else "down" if slope < -0.1 else "stable"
        
        sma = statistics.mean(prices)
        ema = prices[0]
        alpha = 2 / (n + 1)
        for price in prices[1:]:
            ema = alpha * price + (1 - alpha) * ema
        
        return {
            "trend": direction,
            "slope": slope,
            "direction": direction,
            "sma": sma,
            "ema": ema,
            "change_percent": ((prices[-1] - prices[0]) / prices[0] * 100) if prices[0] > 0 else 0
        }

    @staticmethod
    def calculate_demand_proxy(offers: List[Dict], price_history: List[Dict] = None) -> Dict:
        sellers_count = len(set(o.get("seller_name", "") for o in offers))
        
        price_updates = 0
        if price_history:
            price_updates = len(price_history)
        
        purchase_count_proxy = sum(o.get("seller_reviews_count", 0) or 0 for o in offers)
        
        avg_rating = statistics.mean([o.get("seller_rating", 0) or 0 for o in offers if o.get("seller_rating")]) if offers else 0
        
        demand_score = (
            (sellers_count / 10) * 0.3 +
            (min(price_updates / 100, 1)) * 0.2 +
            (min(purchase_count_proxy / 1000, 1)) * 0.3 +
            (avg_rating / 5) * 0.2
        )
        
        return {
            "demand_score": demand_score,
            "sellers_count": sellers_count,
            "price_updates_count": price_updates,
            "purchase_count_proxy": purchase_count_proxy,
            "avg_rating": avg_rating,
            "competition_level": "high" if sellers_count > 10 else "medium" if sellers_count > 5 else "low"
        }

    @staticmethod
    def calculate_optimal_price(offers: List[Dict], target_position: int = 5, margin_percent: float = 0.1) -> Dict:
        if not offers:
            return {"optimal_price": None, "estimated_position": None, "margin": None}
        
        prices = sorted([o.get("price", 0) for o in offers])
        if not prices:
            return {"optimal_price": None, "estimated_position": None, "margin": None}
        
        target_idx = min(target_position - 1, len(prices) - 1)
        optimal_price = prices[target_idx]
        
        cost_price = optimal_price / (1 + margin_percent)
        margin_amount = optimal_price - cost_price
        
        return {
            "optimal_price": optimal_price,
            "estimated_position": target_position,
            "margin_percent": margin_percent * 100,
            "margin_amount": margin_amount,
            "cost_price": cost_price
        }

    @staticmethod
    def calculate_entry_barrier(offers: List[Dict]) -> Dict:
        if not offers:
            return {"barrier_score": 0, "level": "low", "factors": []}
        
        prices = [o.get("price", 0) for o in offers]
        ratings = [o.get("seller_rating", 0) or 0 for o in offers if o.get("seller_rating")]
        
        price_density = len(set(prices)) / len(prices) if prices else 0
        avg_rating = statistics.mean(ratings) if ratings else 0
        top_rating = max(ratings) if ratings else 0
        
        price_range = max(prices) - min(prices) if prices else 0
        price_std = statistics.stdev(prices) if len(prices) > 1 else 0
        
        barrier_score = (
            (1 - price_density) * 0.3 +
            (avg_rating / 5) * 0.3 +
            (top_rating / 5) * 0.2 +
            (min(price_std / 100, 1)) * 0.2
        )
        
        level = "high" if barrier_score > 0.7 else "medium" if barrier_score > 0.4 else "low"
        
        factors = []
        if price_density < 0.3:
            factors.append("Высокая плотность цен")
        if avg_rating > 4.5:
            factors.append("Высокий средний рейтинг конкурентов")
        if top_rating > 4.8:
            factors.append("Есть продавцы с очень высоким рейтингом")
        if price_std < 20:
            factors.append("Низкая волатильность цен")
        
        return {
            "barrier_score": barrier_score,
            "level": level,
            "factors": factors,
            "price_density": price_density,
            "avg_rating": avg_rating,
            "top_rating": top_rating,
            "price_std": price_std
        }

    @staticmethod
    def detect_anomalies(price_history: List[Dict], offers: List[Dict]) -> List[Dict]:
        anomalies = []
        
        if len(price_history) < 3:
            return anomalies
        
        prices = [r.get("price", 0) for r in price_history if r.get("price")]
        if len(prices) < 3:
            return anomalies
        
        mean = statistics.mean(prices)
        std = statistics.stdev(prices) if len(prices) > 1 else 0
        
        for i, record in enumerate(price_history[-10:]):
            price = record.get("price", 0)
            if std > 0 and abs(price - mean) > 2 * std:
                anomalies.append({
                    "type": "price_spike" if price > mean else "price_drop",
                    "date": record.get("date", ""),
                    "price": price,
                    "deviation": abs(price - mean) / std,
                    "message": f"Резкое {'повышение' if price > mean else 'снижение'} цены на {abs(price - mean):.2f} тенге"
                })
        
        current_prices = [o.get("price", 0) for o in offers]
        if current_prices and prices:
            current_avg = statistics.mean(current_prices)
            historical_avg = statistics.mean(prices[-30:]) if len(prices) >= 30 else statistics.mean(prices)
            
            if abs(current_avg - historical_avg) > historical_avg * 0.1:
                anomalies.append({
                    "type": "market_shift",
                    "date": "current",
                    "price": current_avg,
                    "deviation": abs(current_avg - historical_avg) / historical_avg,
                    "message": f"Средняя цена рынка изменилась на {abs(current_avg - historical_avg):.2f} тенге ({abs(current_avg - historical_avg) / historical_avg * 100:.1f}%)"
                })
        
        return anomalies
