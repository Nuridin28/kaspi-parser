from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
from app.api.v1 import products, analytics, reports, jobs, scheduler, websocket
from app.core.config import settings
from app.core.database import engine, Base
from app.core.rate_limit import limiter
from app.core.logging_config import setup_logging
from app.core.exceptions import (
    validation_exception_handler,
    database_exception_handler,
    general_exception_handler
)
from app.services.scheduler import start_scheduler, shutdown_scheduler
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime
import logging

setup_logging()
logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    shutdown_scheduler()

app = FastAPI(
    title="Kaspi Shop Panel API",
    description="API для парсинга и аналитики цен товаров Kaspi",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=[
        {"name": "products", "description": "Операции с товарами"},
        {"name": "analytics", "description": "Аналитика цен"},
        {"name": "reports", "description": "Генерация отчетов"},
        {"name": "jobs", "description": "Управление задачами парсинга"},
        {"name": "scheduler", "description": "Планировщик задач"},
        {"name": "websocket", "description": "WebSocket для real-time обновлений"},
    ]
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(SQLAlchemyError, database_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router, prefix="/api/v1/products", tags=["products"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["analytics"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["reports"])
app.include_router(jobs.router, prefix="/api/v1/jobs", tags=["jobs"])
app.include_router(scheduler.router, prefix="/api/v1/scheduler", tags=["scheduler"])
app.include_router(websocket.router, prefix="/api/v1", tags=["websocket"])


@app.get("/")
async def root():
    return {"message": "Kaspi Shop Panel API", "version": "1.0.0"}


@app.get("/health")
async def health():
    from app.core.database import SessionLocal
    from app.core.redis_client import redis_client
    from app.core.minio_client import minio_client
    from sqlalchemy.exc import SQLAlchemyError
    import redis.exceptions as redis_exceptions
    from minio.error import S3Error
    
    checks = {
        "database": {"status": False, "error": None},
        "redis": {"status": False, "error": None},
        "minio": {"status": False, "error": None}
    }
    
    db = None
    try:
        db = SessionLocal()
        db.execute("SELECT 1")
        checks["database"]["status"] = True
    except SQLAlchemyError as e:
        logger.error(f"Database health check failed: {e}")
        checks["database"]["error"] = str(e)
    except Exception as e:
        logger.error(f"Unexpected error in database health check: {e}")
        checks["database"]["error"] = f"Unexpected error: {str(e)}"
    finally:
        if db:
            try:
                db.close()
            except:
                pass
    
    try:
        redis_client.client.ping()
        checks["redis"]["status"] = True
    except redis_exceptions.ConnectionError as e:
        logger.error(f"Redis connection error: {e}")
        checks["redis"]["error"] = f"Connection error: {str(e)}"
    except redis_exceptions.TimeoutError as e:
        logger.error(f"Redis timeout error: {e}")
        checks["redis"]["error"] = f"Timeout error: {str(e)}"
    except Exception as e:
        logger.error(f"Unexpected error in Redis health check: {e}")
        checks["redis"]["error"] = f"Unexpected error: {str(e)}"
    
    try:
        minio_client.client.bucket_exists(settings.MINIO_BUCKET)
        checks["minio"]["status"] = True
    except S3Error as e:
        logger.error(f"MinIO S3 error: {e}")
        checks["minio"]["error"] = f"S3 error: {str(e)}"
    except Exception as e:
        logger.error(f"Unexpected error in MinIO health check: {e}")
        checks["minio"]["error"] = f"Unexpected error: {str(e)}"
    
    all_healthy = all(check["status"] for check in checks.values())
    status = "healthy" if all_healthy else "unhealthy"
    
    return {
        "status": status,
        "checks": checks,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/metrics")
async def metrics():
    from app.core.metrics import get_metrics
    return Response(content=get_metrics(), media_type="text/plain")

