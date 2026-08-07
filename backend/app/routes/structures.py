from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_db
from app.schemas.structure import StructureCreate
from app.services.structure_service import fetch_pdb

router = APIRouter(prefix="/structures", tags=["Structures"])

@router.post("/fetch-pdb")
async def fetch_structure(pdb_id: str, db: AsyncSession = Depends(get_db)):
    data = fetch_pdb(pdb_id)
    return {"pdb_id": pdb_id, "status": "fetched"}

@router.post("/prepare")
async def prepare_structure(structure_id: str, db: AsyncSession = Depends(get_db)):
    return {"status": "prepared", "structure_id": structure_id}
