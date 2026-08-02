from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
import json

router = APIRouter(prefix="/ws/jobs")

@router.websocket("/{job_id}")
async def job_status_ws(websocket: WebSocket, job_id: str):
    await websocket.accept()
    try:
        for i in range(1, 11):
            await asyncio.sleep(1)
            await websocket.send_json({
                "job_id": job_id,
                "status": "running",
                "progress_pct": i * 10,
                "message": f"Step {i} completed"
            })
        await websocket.send_json({
            "job_id": job_id,
            "status": "completed",
            "progress_pct": 100,
            "message": "Done"
        })
    except WebSocketDisconnect:
        pass
