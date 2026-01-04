from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.schemas.job import JobResponse
from app.models.job import ParsingJob
from app.core.redis_client import redis_client

router = APIRouter()


@router.get("/", response_model=List[JobResponse])
async def list_jobs(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    jobs = db.query(ParsingJob).order_by(ParsingJob.created_at.desc()).offset(skip).limit(limit).all()
    return jobs


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: int,
    db: Session = Depends(get_db)
):
    job = db.query(ParsingJob).filter(ParsingJob.id == job_id).first()
    if not job:
        status = redis_client.get_job_status(str(job_id))
        if status:
            return status
        return None
    return job


@router.get("/{job_id}/status")
async def get_job_status(
    job_id: int,
    db: Session = Depends(get_db)
):
    status = redis_client.get_job_status(str(job_id))
    if status:
        return status
    
    job = db.query(ParsingJob).filter(ParsingJob.id == job_id).first()
    if not job:
        return {"status": "not_found"}
    
    return {
        "id": job.id,
        "status": job.status.value,
        "error_message": job.error_message
    }

