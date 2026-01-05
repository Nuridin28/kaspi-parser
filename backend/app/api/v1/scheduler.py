from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.core.database import get_db
from app.models.scheduler import SchedulerConfig
from app.schemas.scheduler import (
    SchedulerConfigResponse,
    SchedulerConfigUpdate,
    SchedulerConfigCreate
)
from app.services.scheduler import scheduler, update_job_schedule, get_or_create_scheduler_config

router = APIRouter()


@router.get("/", response_model=List[SchedulerConfigResponse])
async def list_scheduler_configs(db: Session = Depends(get_db)):
    configs = db.query(SchedulerConfig).all()
    
    default_jobs = ["daily_price_update", "daily_analytics_aggregation"]
    existing_job_ids = {c.job_id for c in configs}
    
    for job_id in default_jobs:
        if job_id not in existing_job_ids:
            config = get_or_create_scheduler_config(db, job_id)
            configs.append(config)
    
    return configs


@router.get("/{job_id}", response_model=SchedulerConfigResponse)
async def get_scheduler_config(job_id: str, db: Session = Depends(get_db)):
    config = db.query(SchedulerConfig).filter(SchedulerConfig.job_id == job_id).first()
    if not config:
        config = get_or_create_scheduler_config(db, job_id)
    return config


@router.put("/{job_id}", response_model=SchedulerConfigResponse)
async def update_scheduler_config(
    job_id: str,
    config_update: SchedulerConfigUpdate,
    db: Session = Depends(get_db)
):
    config = db.query(SchedulerConfig).filter(SchedulerConfig.job_id == job_id).first()
    if not config:
        config = get_or_create_scheduler_config(db, job_id)
    
    if config_update.enabled is not None:
        config.enabled = config_update.enabled
    if config_update.interval_hours is not None:
        config.interval_hours = config_update.interval_hours
    if config_update.interval_minutes is not None:
        config.interval_minutes = config_update.interval_minutes
    if config_update.cron_hour is not None:
        config.cron_hour = min(max(0, config_update.cron_hour), 23)
    if config_update.cron_minute is not None:
        config.cron_minute = min(max(0, config_update.cron_minute), 59)
    
    config.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(config)
    
    # Обновляем расписание
    update_job_schedule(job_id, config)
    
    return config


@router.post("/", response_model=SchedulerConfigResponse)
async def create_scheduler_config(
    config_create: SchedulerConfigCreate,
    db: Session = Depends(get_db)
):
    existing = db.query(SchedulerConfig).filter(
        SchedulerConfig.job_id == config_create.job_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Scheduler config already exists")
    
    config = SchedulerConfig(
        job_id=config_create.job_id,
        enabled=config_create.enabled,
        interval_hours=config_create.interval_hours,
        interval_minutes=config_create.interval_minutes,
        cron_hour=config_create.cron_hour,
        cron_minute=config_create.cron_minute
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    
    # Обновляем расписание
    update_job_schedule(config.job_id, config)
    
    return config


@router.get("/{job_id}/next-run")
async def get_next_run_time(job_id: str):
    try:
        job = scheduler.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        next_run = job.next_run_time
        return {
            "job_id": job_id,
            "next_run_time": next_run.isoformat() if next_run else None,
            "enabled": job.next_run_time is not None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analytics/aggregate-now")
async def aggregate_analytics_now(db: Session = Depends(get_db)):
    from app.services.scheduler import daily_analytics_aggregation
    await daily_analytics_aggregation()
    return {"message": "Analytics aggregation completed"}

