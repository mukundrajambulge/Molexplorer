from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_db
from app.schemas.docking import DockingJobSubmit, DockingJobResponse
from app.services.docking_service import submit_docking_job, get_job_status
import uuid

router = APIRouter(prefix="/docking", tags=["Docking"])

@router.post("/submit")
async def submit_job(job: DockingJobSubmit, db: AsyncSession = Depends(get_db)):
    job_id = submit_docking_job(job.receptor_pdb, job.ligand_data, job.params)
    return {"job_id": job_id, "status": "pending"}

@router.get("/{job_id}/status")
async def get_status(job_id: str, db: AsyncSession = Depends(get_db)):
    status = get_job_status(job_id)
    return status

@router.get("/{job_id}/results")
async def get_results(job_id: str, db: AsyncSession = Depends(get_db)):
    return {"job_id": job_id, "results": {"score": -8.5}}
