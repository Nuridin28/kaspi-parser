from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse, JSONResponse, StreamingResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.minio_client import minio_client
from app.services.product_service import ProductService
from app.services.report_service import ReportService
from typing import List
import io

router = APIRouter()


@router.get("/files/{object_name:path}")
async def download_file(
    object_name: str
):
    try:
        file_data = minio_client.get_file(object_name)
        filename = object_name.split('/')[-1] if '/' in object_name else object_name
        
        return StreamingResponse(
            io.BytesIO(file_data),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"File not found: {str(e)}")


@router.get("/products/{product_id}/excel")
async def generate_product_excel(
    product_id: int,
    return_json: bool = Query(False, description="Return JSON with URL instead of redirect"),
    db: Session = Depends(get_db)
):
    product = ProductService.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    try:
        object_name = ReportService.generate_product_excel(db, product_id)
        file_url = f"/api/v1/reports/files/{object_name}"
        if return_json:
            return JSONResponse(content={"url": file_url, "filename": f"product_{product_id}_report.xlsx"})
        return RedirectResponse(url=file_url, status_code=302)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        import traceback
        error_detail = str(e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating report: {error_detail}")


@router.get("/products/compare/excel")
async def compare_products_excel(
    product_id_1: int,
    product_id_2: int,
    return_json: bool = Query(False, description="Return JSON with URL instead of redirect"),
    db: Session = Depends(get_db)
):
    product1 = ProductService.get_product(db, product_id_1)
    product2 = ProductService.get_product(db, product_id_2)
    
    if not product1 or not product2:
        raise HTTPException(status_code=404, detail="One or both products not found")
    
    try:
        object_name = ReportService.generate_comparison_excel(db, product_id_1, product_id_2)
        file_url = f"/api/v1/reports/files/{object_name}"
        if return_json:
            return JSONResponse(content={"url": file_url, "filename": f"comparison_{product_id_1}_vs_{product_id_2}.xlsx"})
        return RedirectResponse(url=file_url, status_code=302)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating report: {str(e)}")


@router.get("/products/{product_id}/advanced-excel")
async def generate_advanced_analytics_excel(
    product_id: int,
    user_price: float = Query(None, description="User price for analysis"),
    return_json: bool = Query(False, description="Return JSON with URL instead of redirect"),
    db: Session = Depends(get_db)
):
    product = ProductService.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    try:
        object_name = ReportService.generate_advanced_analytics_report(db, product_id, user_price)
        file_url = f"/api/v1/reports/files/{object_name}"
        if return_json:
            return JSONResponse(content={"url": file_url, "filename": f"advanced_analytics_{product_id}.xlsx"})
        return RedirectResponse(url=file_url, status_code=302)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating report: {str(e)}")


@router.get("/files")
async def list_reports(
    prefix: str = Query("reports/", description="Prefix to filter files"),
    limit: int = Query(100, description="Maximum number of files to return")
):
    try:
        files = minio_client.list_files(prefix=prefix)
        files_with_urls = []
        for file_info in files[:limit]:
            file_url = f"/api/v1/reports/files/{file_info['name']}"
            filename = file_info['name'].split('/')[-1] if '/' in file_info['name'] else file_info['name']
            files_with_urls.append({
                **file_info,
                "url": file_url,
                "filename": filename
            })
        return JSONResponse(content={"files": files_with_urls, "total": len(files)})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing reports: {str(e)}")


@router.delete("/files/{object_name:path}")
async def delete_report(object_name: str):
    try:
        minio_client.delete_file(object_name)
        return JSONResponse(content={"message": "File deleted successfully"})
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"File not found: {str(e)}")

