import re
import httpx
from typing import Dict, List, Optional
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    retry_if_result,
    RetryError
)
import logging

logger = logging.getLogger(__name__)

KASPI_API_URL = "https://kaspi.kz/yml/offer-view/offers/{product_id}"


class KaspiAPIParser:
    def __init__(
        self,
        city_id: str = "750000000",
        timeout: int = 10,
        top_n: int = 10,
        proxy: Optional[str] = None,
    ):
        self.city_id = city_id
        self.timeout = timeout
        self.top_n = top_n
        self.proxy = proxy

    def extract_product_id(self, url: str) -> str:
        url = url.strip().rstrip('/')
        
        patterns = [
            r"/shop/p/[^/]+/(\d+)",
            r"/shop/p/(\d+)",
            r"/product/(\d+)",
            r"/p/[^/]+/(\d+)",
            r"/p/(\d+)",
            r"/(\d{6,})",
            r"(\d{6,})",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                product_id = match.group(1)
                if product_id and len(product_id) >= 6:
                    return product_id
        
        raise ValueError(f"Cannot extract product id from URL: {url}")

    async def _make_request(self, product_id: str, headers: Dict, payload: Dict) -> Dict:
        async with httpx.AsyncClient(
            timeout=self.timeout,
            proxies=self.proxy,
            http2=True,
            follow_redirects=True,
            cookies={},
        ) as client:
            try:
                init_response = await client.get(
                    "https://kaspi.kz",
                    headers={
                        "User-Agent": headers["User-Agent"],
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    },
                    timeout=self.timeout,
                )
                if "kaspi.storefront.cookie.city" not in client.cookies:
                    client.cookies.set("kaspi.storefront.cookie.city", self.city_id, domain="kaspi.kz")
            except Exception as e:
                logger.warning(f"Could not initialize session: {e}")
            
            response = await client.post(
                KASPI_API_URL.format(product_id=product_id),
                headers=headers,
                json=payload,
            )

            response.raise_for_status()
            return response.json()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((
            httpx.TimeoutException,
            httpx.NetworkError,
            httpx.ConnectError,
            httpx.ReadError,
            httpx.HTTPStatusError
        )),
        reraise=True
    )
    async def parse_product(self, product_url: str) -> Dict:
        product_id = self.extract_product_id(product_url)

        headers = {
            "Accept": "application/json, text/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Content-Type": "application/json; charset=UTF-8",
            "Origin": "https://kaspi.kz",
            "Referer": product_url,
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"
            ),
            "X-KS-City": self.city_id,
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "sec-ch-ua": '"Chromium";v="143", "Not A(Brand";v="24"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"',
        }

        payload = {
            "cityId": self.city_id,
            "id": str(product_id),
            "merchantUID": [],
            "limit": self.top_n,
            "page": 0,
            "product": {
                "brand": None,
                "categoryCodes": [],
                "baseProductCodes": [],
                "groups": None,
                "productSeries": []
            },
            "sortOption": "PRICE",
            "highRating": None,
            "searchText": None,
            "isExcellentMerchant": False,
            "zoneId": ["Magnum_ZONE1"],
            "installationId": "-1",
        }

        try:
            data = await self._make_request(product_id, headers, payload)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 400:
                logger.error(f"HTTP 400 for product {product_id}: {e.response.text}")
                raise ValueError(f"Invalid request for product {product_id}: {e.response.text}")
            elif e.response.status_code == 404:
                logger.error(f"Product {product_id} not found")
                raise ValueError(f"Product {product_id} not found")
            elif e.response.status_code >= 500:
                logger.warning(f"Server error {e.response.status_code} for product {product_id}, will retry")
                raise
            else:
                raise
        except (httpx.TimeoutException, httpx.NetworkError, httpx.ConnectError, httpx.ReadError) as e:
            logger.warning(f"Network error for product {product_id}: {e}, will retry")
            raise
        except RetryError as e:
            logger.error(f"Failed to parse product {product_id} after retries: {e.last_attempt.exception()}")
            raise e.last_attempt.exception()

        return self._normalize_response(product_id, data)

    def _normalize_response(self, product_id: str, data: Dict) -> Dict:
        offers_raw = data.get("offers", [])
        total_sellers = data.get("total") or data.get("offersCount")
        
        product_name = None
        category = None
        
        if offers_raw:
            first_offer = offers_raw[0]
            product_name = first_offer.get("productName") or first_offer.get("name")
            category = first_offer.get("categoryName") or first_offer.get("category")

        offers: List[Dict] = []

        for idx, offer in enumerate(offers_raw[: self.top_n]):
            offers.append(
                {
                    "position": idx + 1,
                    "price": offer["price"],
                    "price_minus_bonus": offer.get("priceMinusBonus"),
                    "seller_id": offer.get("merchantId"),
                    "seller_name": offer.get("merchantName"),
                    "rating": offer.get("merchantRating"),
                    "reviews_count": offer.get("merchantReviewsQuantity", 0),
                    "purchase_count": offer.get("purchaseCount", 0),
                    "in_stock": offer.get("preorder", 0) == 0,
                    "delivery_type": offer.get("deliveryType"),
                }
            )

        prices = [o["price"] for o in offers]

        price_buckets = {
            "min_price": min(prices) if prices else 0,
            "max_price": max(prices) if prices else 0,
            "top_sellers_count": len(offers),
            "total_sellers_count": total_sellers,
        }

        return {
            "kaspi_id": product_id,
            "name": product_name or f"Product {product_id}",
            "category": category,
            "offers": offers,
            "price_buckets": price_buckets,
            "raw_total_sellers": total_sellers,
        }
