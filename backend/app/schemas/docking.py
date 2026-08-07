from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class DockingJobSubmit(BaseModel):
    receptor_pdb: str
    ligand_data: str
    params: Optional[Dict[str, Any]] = None

class DockingJobResponse(BaseModel):
    id: str
    status: str
    params: Optional[Dict[str, Any]] = None
    results: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
