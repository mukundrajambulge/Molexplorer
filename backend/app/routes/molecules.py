from fastapi import APIRouter, Depends
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_db
from app.schemas.molecule import MoleculeCreate, MoleculeResponse
from app.services.molecule_service import compute_descriptors, compute_fingerprint

router = APIRouter(prefix="/molecules", tags=["Molecules"])

@router.post("/upload", response_model=dict)
async def upload_molecule(mol: MoleculeCreate, db: AsyncSession = Depends(get_db)):
    # TODO: Add logic to save molecule
    return {"message": "Molecule uploaded successfully", "data": mol.model_dump()}

@router.get("", response_model=List[MoleculeResponse])
async def list_molecules(db: AsyncSession = Depends(get_db)):
    return []

@router.get("/{id}/descriptors")
async def get_descriptors(id: str, db: AsyncSession = Depends(get_db)):
    # Mock return
    return compute_descriptors("C")
