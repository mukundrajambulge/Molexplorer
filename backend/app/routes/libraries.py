from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_db
from app.schemas.library import LibraryCreate, LibraryResponse

router = APIRouter(prefix="/libraries", tags=["Libraries"])

@router.post("", response_model=dict)
async def create_library(lib: LibraryCreate, db: AsyncSession = Depends(get_db)):
    return {"message": "Library created"}

@router.get("")
async def list_libraries(db: AsyncSession = Depends(get_db)):
    return []
