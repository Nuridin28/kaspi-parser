from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from app.core.database import Base


class SchedulerConfig(Base):
    __tablename__ = "scheduler_config"
    
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String, unique=True, nullable=False, index=True)
    enabled = Column(Boolean, default=True, nullable=False)
    interval_hours = Column(Integer, default=24, nullable=False)
    interval_minutes = Column(Integer, default=0, nullable=False)
    cron_hour = Column(Integer)
    cron_minute = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

