from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.api.v1 import products, analytics, reports, jobs, scheduler
from app.core.config import settings
from app.core.database import engine, Base
from app.services.scheduler import start_scheduler, shutdown_scheduler

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
    lifespan=lifespan
)

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


@app.get("/")
async def root():
    return {"message": "Kaspi Shop Panel API", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}

