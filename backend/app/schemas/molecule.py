from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class MoleculeBase(BaseModel):
    name: Optional[str] = None
    smiles: str
    format: Optional[str] = None

class MoleculeCreate(MoleculeBase):
    raw_content: Optional[str] = None
    library_id: Optional[str] = None

class MoleculeResponse(MoleculeBase):
    id: str
    descriptors: Optional[Dict[str, Any]] = None
    fingerprint: Optional[str] = None
    library_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
