from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.product_service import ProductService
from app.services.report_service import ReportService
from typing import List
import tempfile
import os

router = APIRouter()


@router.get("/products/{product_id}/excel")
async def generate_product_excel(
    product_id: int,
    db: Session = Depends(get_db)
):
    product = ProductService.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    file_path = ReportService.generate_product_excel(db, product_id)
    
    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=f"product_{product_id}_report.xlsx"
    )


@router.get("/products/compare/excel")
async def compare_products_excel(
    product_id_1: int,
    product_id_2: int,
    db: Session = Depends(get_db)
):
    product1 = ProductService.get_product(db, product_id_1)
    product2 = ProductService.get_product(db, product_id_2)
    
    if not product1 or not product2:
        raise HTTPException(status_code=404, detail="One or both products not found")
    
    file_path = ReportService.generate_comparison_excel(db, product_id_1, product_id_2)
    
    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=f"comparison_{product_id_1}_vs_{product_id_2}.xlsx"
    )


@router.get("/products/{product_id}/advanced-excel")
async def generate_advanced_analytics_excel(
    product_id: int,
    user_price: float = Query(None, description="User price for analysis"),
    db: Session = Depends(get_db)
):
    product = ProductService.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    file_path = ReportService.generate_advanced_analytics_report(db, product_id, user_price)
    
    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=f"advanced_analytics_{product_id}.xlsx"
    )

