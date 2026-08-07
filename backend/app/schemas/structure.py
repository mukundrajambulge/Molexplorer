from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class StructureBase(BaseModel):
    pdb_id: Optional[str] = None
    name: Optional[str] = None
    format: Optional[str] = None

class StructureCreate(StructureBase):
    raw_data: str
    metadata_json: Optional[Dict[str, Any]] = None

class StructureResponse(StructureBase):
    id: str
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True
