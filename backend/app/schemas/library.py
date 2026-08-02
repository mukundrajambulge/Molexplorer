from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class LibraryBase(BaseModel):
    name: str
    description: Optional[str] = None

class LibraryCreate(LibraryBase):
    pass

class LibraryResponse(LibraryBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True
