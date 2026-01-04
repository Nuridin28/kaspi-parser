from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.job import JobStatus


class JobCreate(BaseModel):
    url: str


class JobResponse(BaseModel):
    id: int
    kaspi_url: str
    kaspi_product_id: Optional[str]
    status: JobStatus
    error_message: Optional[str]
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True

