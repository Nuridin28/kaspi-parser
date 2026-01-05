from fastapi import APIRouter, WebSocket, WebSocketDisconnect
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
        self.product_connections: Dict[int, Set[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, job_id: int):
        await websocket.accept()
        if job_id not in self.active_connections:
            self.active_connections[job_id] = set()
        self.active_connections[job_id].add(websocket)
    
    async def connect_product(self, websocket: WebSocket, product_id: int):
        await websocket.accept()
        if product_id not in self.product_connections:
            self.product_connections[product_id] = set()
        self.product_connections[product_id].add(websocket)
    
    def disconnect(self, websocket: WebSocket, job_id: int):
        if job_id in self.active_connections:
            self.active_connections[job_id].discard(websocket)
            if not self.active_connections[job_id]:
                del self.active_connections[job_id]
    
    def disconnect_product(self, websocket: WebSocket, product_id: int):
        if product_id in self.product_connections:
            self.product_connections[product_id].discard(websocket)
            if not self.product_connections[product_id]:
                del self.product_connections[product_id]
    
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
    
    async def broadcast_to_product(self, product_id: int, message: dict):
        if product_id in self.product_connections:
            disconnected = set()
            for connection in self.product_connections[product_id]:
                try:
                    await connection.send_json(message)
                except:
                    disconnected.add(connection)
            for conn in disconnected:
                self.disconnect_product(conn, product_id)
    
    async def broadcast_to_all(self, message: dict):
        all_connections = set()
        for connections in self.product_connections.values():
            all_connections.update(connections)
        
        disconnected = set()
        for connection in all_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.add(connection)
        
        for conn in disconnected:
            for product_id, connections in list(self.product_connections.items()):
                if conn in connections:
                    self.disconnect_product(conn, product_id)

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
                    "status": status.get("status") if isinstance(status, dict) else status
                }, websocket)
            
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        manager.disconnect(websocket, job_id)

@router.websocket("/ws/products")
async def products_websocket_endpoint(websocket: WebSocket):
    await manager.connect_product(websocket, 0)
    try:
        while True:
            await asyncio.sleep(5)
            try:
                await websocket.send_json({
                    "type": "ping",
                    "message": "keep_alive"
                })
            except Exception:
                break
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect_product(websocket, 0)

async def notify_job_status(job_id: int, status: str, message: str = None):
    await manager.broadcast_to_job(job_id, {
        "type": "status_update",
        "job_id": job_id,
        "status": status,
        "message": message
    })

async def notify_product_updated(product_id: int):
    await manager.broadcast_to_all({
        "type": "product_updated",
        "product_id": product_id,
        "message": "Product data has been updated"
    })

async def notify_job_completed(job_id: int, status: str):
    await manager.broadcast_to_all({
        "type": "job_completed",
        "job_id": job_id,
        "status": status,
        "message": f"Job {job_id} {status}"
    })
