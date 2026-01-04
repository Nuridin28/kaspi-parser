from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.job import ParsingJob, JobStatus
from app.core.redis_client import redis_client
import json
import asyncio
from typing import Dict, Set

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, Set[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, job_id: int):
        await websocket.accept()
        if job_id not in self.active_connections:
            self.active_connections[job_id] = set()
        self.active_connections[job_id].add(websocket)
    
    def disconnect(self, websocket: WebSocket, job_id: int):
        if job_id in self.active_connections:
            self.active_connections[job_id].discard(websocket)
            if not self.active_connections[job_id]:
                del self.active_connections[job_id]
    
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)
    
    async def broadcast_to_job(self, job_id: int, message: dict):
        if job_id in self.active_connections:
            disconnected = set()
            for connection in self.active_connections[job_id]:
                try:
                    await connection.send_json(message)
                except:
                    disconnected.add(connection)
            for conn in disconnected:
                self.disconnect(conn, job_id)

manager = ConnectionManager()

@router.websocket("/ws/jobs/{job_id}")
async def websocket_endpoint(websocket: WebSocket, job_id: int):
    await manager.connect(websocket, job_id)
    try:
        while True:
            status = redis_client.get_job_status(str(job_id))
            if status:
                await manager.send_personal_message({
                    "type": "status_update",
                    "job_id": job_id,
                    "status": status
                }, websocket)
            
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        manager.disconnect(websocket, job_id)

async def notify_job_status(job_id: int, status: str, message: str = None):
    await manager.broadcast_to_job(job_id, {
        "type": "status_update",
        "job_id": job_id,
        "status": status,
        "message": message
    })

