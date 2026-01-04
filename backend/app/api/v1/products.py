from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request, Query
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import csv
import io
import json
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.schemas.product import ProductCreate, ProductResponse, BulkProductCreate, ProductUpdate
from app.schemas.job import JobResponse
from app.services.product_service import ProductService
from app.models.job import ParsingJob
from app.core.redis_client import redis_client
import uuid

router = APIRouter()


@router.post("/", response_model=JobResponse, status_code=202)
@limiter.limit("10/minute")
async def create_product(
    request: Request,
    product: ProductCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    job = ParsingJob(kaspi_url=str(product.url))
    db.add(job)
    db.commit()
    db.refresh(job)
    
    redis_client.set_job_status(str(job.id), "pending")
    
    background_tasks.add_task(
        ProductService.parse_and_save_product,
        str(product.url),
        job.id
    )
    
    return job


@router.post("/bulk", response_model=List[JobResponse], status_code=202)
@limiter.limit("5/minute")
async def create_products_bulk(
    request: Request,
    products: BulkProductCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    jobs = []
    
    for url in products.urls:
        job = ParsingJob(kaspi_url=str(url))
        db.add(job)
        jobs.append(job)
    
    db.commit()
    
    for job in jobs:
        db.refresh(job)
        redis_client.set_job_status(str(job.id), "pending")
        background_tasks.add_task(
            ProductService.parse_and_save_product,
            job.kaspi_url,
            job.id
        )
    
    return jobs


@router.get("/", response_model=List[ProductResponse])
@limiter.limit("30/minute")
async def list_products(
    request: Request,
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=100, description="Maximum number of records to return"),
    search: Optional[str] = Query(None, description="Search by name or category"),
    db: Session = Depends(get_db)
):
    products = ProductService.list_products(db, skip=skip, limit=limit, search=search)
    return products


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: int,
    db: Session = Depends(get_db)
):
    product = ProductService.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.get("/kaspi/{kaspi_id}", response_model=ProductResponse)
async def get_product_by_kaspi_id(
    kaspi_id: str,
    db: Session = Depends(get_db)
):
    product = ProductService.get_product_by_kaspi_id(db, kaspi_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,
    product_update: ProductUpdate,
    db: Session = Depends(get_db)
):
    product = ProductService.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if product_update.name is not None:
        product.name = product_update.name
    if product_update.category is not None:
        product.category = product_update.category
    
    product.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(product)
    
    return product


@router.delete("/{product_id}", status_code=204)
async def delete_product(
    product_id: int,
    db: Session = Depends(get_db)
):
    product = ProductService.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    db.delete(product)
    db.commit()
    
    redis_client.delete_key(f"product:{product_id}:offers")
    redis_client.delete_key(f"product:{product_id}:buckets")
    
    return None


@router.post("/{product_id}/parse", response_model=JobResponse, status_code=202)
async def parse_product(
    product_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    product = ProductService.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    url = f"https://kaspi.kz/shop/p/{product.kaspi_id}/"
    job = ParsingJob(kaspi_url=url)
    db.add(job)
    db.commit()
    db.refresh(job)
    
    redis_client.set_job_status(str(job.id), "pending")
    
    background_tasks.add_task(
        ProductService.parse_and_save_product,
        url,
        job.id
    )
    
    return job

