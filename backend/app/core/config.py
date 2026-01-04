from pydantic_settings import BaseSettings
from typing import List
import os
import json


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://kaspi_user:kaspi_password@localhost:5432/kaspi_db"
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_TTL: int = 86400
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_PUBLIC_URL: str = "http://localhost:9000"  # Public URL for presigned URLs (accessible from browser)
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "kaspi-reports"
    MINIO_SECURE: bool = False
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    MAX_RETRIES: int = 3
    PARSING_TIMEOUT: int = 30
    TOP_SELLERS_COUNT: int = 10
    MAX_CONCURRENT_JOBS: int = 5
    PARSING_INTERVAL_HOURS: int = 24
    PARSING_INTERVAL_MINUTES: int = 0
    PARSE_ALL_PRICES: bool = True
    MAX_PARSING_PAGES: int = 50
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        env_file_encoding = 'utf-8'
    
    @property
    def cors_origins_list(self) -> List[str]:
        if isinstance(self.CORS_ORIGINS, str):
            return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        return self.CORS_ORIGINS if isinstance(self.CORS_ORIGINS, list) else []


settings = Settings()
env_key = os.getenv("OPENAI_API_KEY", "")
if env_key:
    settings.OPENAI_API_KEY = env_key
    print(f"DEBUG: Loaded OPENAI_API_KEY from environment (length: {len(env_key)})")
else:
    print(f"DEBUG: OPENAI_API_KEY not found in environment, using default: {settings.OPENAI_API_KEY[:20] if settings.OPENAI_API_KEY else 'empty'}...")

