"""
WebSocket Manager for Real-Time Updates
Handles WebSocket connections and broadcasts job status updates
"""

import asyncio
import json
import logging
from typing import Dict, Set, Optional
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

class WebSocketManager:
    """Manages WebSocket connections for real-time job updates"""

    def __init__(self):
        # Set of active WebSocket connections
        self.active_connections: Set[WebSocket] = set()
        # Track which job each connection is subscribed to
        self.job_subscriptions: Dict[WebSocket, str] = {}
        # Event loop reference for thread-safe broadcasting
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def set_event_loop(self, loop: asyncio.AbstractEventLoop):
        """Set the event loop for thread-safe operations"""
        self._loop = loop

    async def connect(self, websocket: WebSocket, job_id: Optional[str] = None):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        self.active_connections.add(websocket)
        if job_id:
            self.job_subscriptions[websocket] = job_id
        logger.info(f"🔌 WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection"""
        self.active_connections.discard(websocket)
        self.job_subscriptions.pop(websocket, None)
        logger.info(f"🔌 WebSocket disconnected. Total connections: {len(self.active_connections)}")

    def subscribe_to_job(self, websocket: WebSocket, job_id: str):
        """Subscribe a connection to a specific job's updates"""
        self.job_subscriptions[websocket] = job_id
        logger.debug(f"📡 WebSocket subscribed to job: {job_id}")

    async def broadcast_job_update(self, job_id: str, data: dict):
        """Broadcast job update to all subscribers of that job"""
        message = json.dumps({
            "type": "job_update",
            "job_id": job_id,
            "data": data
        })

        disconnected = set()
        for websocket in self.active_connections:
            # Send to all connections (they can filter by job_id on client)
            # or only to those subscribed to this specific job
            subscribed_job = self.job_subscriptions.get(websocket)
            if subscribed_job is None or subscribed_job == job_id:
                try:
                    await websocket.send_text(message)
                except Exception as e:
                    logger.warning(f"Failed to send WebSocket message: {e}")
                    disconnected.add(websocket)

        # Clean up disconnected clients
        for ws in disconnected:
            self.disconnect(ws)

    async def broadcast_all(self, data: dict, message_type: str = "update"):
        """Broadcast a message to all connected clients"""
        message = json.dumps({
            "type": message_type,
            "data": data
        })

        disconnected = set()
        for websocket in self.active_connections:
            try:
                await websocket.send_text(message)
            except Exception as e:
                logger.warning(f"Failed to send WebSocket message: {e}")
                disconnected.add(websocket)

        # Clean up disconnected clients
        for ws in disconnected:
            self.disconnect(ws)

    def broadcast_job_update_sync(self, job_id: str, data: dict):
        """
        Thread-safe synchronous method to broadcast job updates.
        Call this from background threads (like job execution threads).
        """
        if self._loop and len(self.active_connections) > 0:
            try:
                asyncio.run_coroutine_threadsafe(
                    self.broadcast_job_update(job_id, data),
                    self._loop
                )
            except Exception as e:
                logger.warning(f"Failed to schedule WebSocket broadcast: {e}")

    @property
    def connection_count(self) -> int:
        """Return number of active connections"""
        return len(self.active_connections)


# Global WebSocket manager instance
websocket_manager = WebSocketManager()
