from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class SchedulerConfigResponse(BaseModel):
    id: int
    job_id: str
    enabled: bool
    interval_hours: int
    interval_minutes: int
    cron_hour: Optional[int]
    cron_minute: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class SchedulerConfigUpdate(BaseModel):
    enabled: Optional[bool] = None
    interval_hours: Optional[int] = None
    interval_minutes: Optional[int] = None
    cron_hour: Optional[int] = None
    cron_minute: Optional[int] = None


class SchedulerConfigCreate(BaseModel):
    job_id: str
    enabled: bool = True
    interval_hours: int = 24
    interval_minutes: int = 0
    cron_hour: Optional[int] = None
    cron_minute: Optional[int] = None

