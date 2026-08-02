import os

base_dir = r"d:\Projects\Molexplorer\backend"

directories = [
    "app",
    "app/models",
    "app/schemas",
    "app/routes",
    "app/services",
    "app/tasks",
    "app/core",
    "tests"
]

files = {
    "requirements.txt": """fastapi==0.110.0
uvicorn==0.27.1
pydantic==2.6.3
pydantic-settings==2.2.1
sqlalchemy==2.0.27
aiosqlite==0.20.0
alembic==1.13.1
celery==5.3.6
redis==5.0.2
pytest==8.0.2
pytest-asyncio==0.23.5
httpx==0.27.0
websockets==12.0
""",
    ".env.example": """DATABASE_URL=sqlite+aiosqlite:///./molexplorer.db
REDIS_URL=redis://localhost:6379/0
API_VERSION=v1
APP_NAME=Molexplorer API
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]
""",
    "README.md": """# Molexplorer Backend

## Setup
1. Create a virtual environment
2. Install requirements: `pip install -r requirements.txt`
3. Run the server: `python -m uvicorn app.main:app --reload`
""",
    "app/__init__.py": "",
    "app/models/__init__.py": "",
    "app/schemas/__init__.py": "",
    "app/routes/__init__.py": "",
    "app/services/__init__.py": "",
    "app/tasks/__init__.py": "",
    "app/core/__init__.py": "",
    "tests/__init__.py": "",
    
    "app/main.py": """from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import settings
from app.routes import health, molecules, libraries, structures, docking, ws
from app.core.middleware import RequestTimingMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.API_VERSION,
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestTimingMiddleware)

# Routers
app.include_router(health.router)
app.include_router(molecules.router, prefix="/api/v1")
app.include_router(libraries.router, prefix="/api/v1")
app.include_router(structures.router, prefix="/api/v1")
app.include_router(docking.router, prefix="/api/v1")
app.include_router(ws.router)
""",
    "app/config.py": """from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import json

class Settings(BaseSettings):
    APP_NAME: str = "Molexplorer API"
    API_VERSION: str = "v1"
    DATABASE_URL: str = "sqlite+aiosqlite:///./molexplorer.db"
    REDIS_URL: str = "redis://localhost:6379/0"
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
""",
    "app/models/base.py": """from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncAttrs
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

class Base(AsyncAttrs, DeclarativeBase):
    pass
""",
    "app/models/molecule.py": """from sqlalchemy import Column, String, Text, ForeignKey, JSON, DateTime
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
from app.models.base import Base

class Molecule(Base):
    __tablename__ = "molecules"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, index=True)
    smiles = Column(String, index=True)
    format = Column(String)
    raw_content = Column(Text)
    descriptors = Column(JSON)
    fingerprint = Column(Text)
    library_id = Column(String(36), ForeignKey("libraries.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
""",
    "app/models/library.py": """from sqlalchemy import Column, String, DateTime
from datetime import datetime
import uuid
from app.models.base import Base

class Library(Base):
    __tablename__ = "libraries"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, index=True)
    description = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
""",
    "app/models/docking_job.py": """from sqlalchemy import Column, String, Text, JSON, DateTime
from datetime import datetime
import uuid
from app.models.base import Base

class DockingJob(Base):
    __tablename__ = "docking_jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    status = Column(String, default="pending") # pending/running/completed/failed
    receptor_pdb = Column(Text)
    ligand_data = Column(Text)
    params = Column(JSON)
    results = Column(JSON)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
""",
    "app/models/structure.py": """from sqlalchemy import Column, String, Text, JSON, DateTime
from datetime import datetime
import uuid
from app.models.base import Base

class Structure(Base):
    __tablename__ = "structures"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    pdb_id = Column(String, index=True, nullable=True)
    name = Column(String)
    raw_data = Column(Text)
    format = Column(String)
    metadata_json = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
""",
    "app/schemas/molecule.py": """from pydantic import BaseModel
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
""",
    "app/schemas/library.py": """from pydantic import BaseModel
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
""",
    "app/schemas/docking.py": """from pydantic import BaseModel
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
""",
    "app/schemas/structure.py": """from pydantic import BaseModel
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
""",
    "app/core/deps.py": """from typing import AsyncGenerator
from app.models.base import AsyncSessionLocal

async def get_db() -> AsyncGenerator:
    async with AsyncSessionLocal() as session:
        yield session
""",
    "app/core/middleware.py": """import time
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request

class RequestTimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        return response
""",
    "app/routes/health.py": """from fastapi import APIRouter
from app.config import settings
import time

router = APIRouter()
startup_time = time.time()

@router.get("/health")
async def health_check():
    return {
        "status": "ok",
        "version": settings.API_VERSION,
        "uptime": time.time() - startup_time
    }
""",
    "app/routes/molecules.py": """from fastapi import APIRouter, Depends
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
""",
    "app/routes/libraries.py": """from fastapi import APIRouter, Depends
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
""",
    "app/routes/structures.py": """from fastapi import APIRouter, Depends
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
""",
    "app/routes/docking.py": """from fastapi import APIRouter, Depends
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
""",
    "app/routes/ws.py": """from fastapi import APIRouter, WebSocket, WebSocketDisconnect
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
""",
    "app/services/molecule_service.py": """from typing import List, Dict, Any

def parse_sdf(content: str) -> List[Dict[str, Any]]:
    # TODO: Implement with RDKit
    return [{"smiles": "CC", "name": "Ethane"}]

def compute_descriptors(smiles: str) -> Dict[str, Any]:
    # TODO: Implement with RDKit
    return {
        "MW": 150.0,
        "LogP": 1.5,
        "TPSA": 40.0,
        "HBD": 1,
        "HBA": 2,
        "QED": 0.8,
        "num_rotatable_bonds": 3
    }

def compute_fingerprint(smiles: str) -> str:
    # TODO: Implement with RDKit
    return "0101010101"

def tanimoto_similarity(fp1: str, fp2: str) -> float:
    # TODO: Implement with RDKit
    return 0.8
""",
    "app/services/structure_service.py": """def fetch_pdb(pdb_id: str) -> str:
    # TODO: Fetch from RCSB API
    return "PDB_CONTENT_MOCK"
""",
    "app/services/docking_service.py": """import uuid

def submit_docking_job(receptor: str, ligand: str, params: dict = None) -> str:
    # TODO: Submit to Celery
    from app.tasks.docking_tasks import run_docking
    job_id = str(uuid.uuid4())
    run_docking.delay(job_id)
    return job_id

def get_job_status(job_id: str) -> dict:
    # TODO: Fetch from DB/Celery
    return {"job_id": job_id, "status": "pending"}
""",
    "app/tasks/celery_app.py": """from celery import Celery
from app.config import settings

celery_app = Celery(
    "molexplorer_tasks",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)
""",
    "app/tasks/docking_tasks.py": """from app.tasks.celery_app import celery_app
import time

@celery_app.task(name="run_docking")
def run_docking(job_id: str):
    # TODO: Implement actual docking (e.g. calling MolDock)
    time.sleep(5)
    return {"job_id": job_id, "status": "completed", "score": -9.2}
""",
    "app/tasks/compute_tasks.py": """from app.tasks.celery_app import celery_app

@celery_app.task(name="compute_batch_descriptors")
def compute_batch_descriptors(molecule_ids: list):
    # TODO: Compute descriptors for multiple molecules
    return {"status": "completed", "count": len(molecule_ids)}
""",
    "tests/test_health.py": """import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "uptime" in data
""",
    "tests/test_molecules.py": """import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_upload_molecule():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post("/api/v1/molecules/upload", json={"smiles": "CCO", "name": "Ethanol"})
    assert response.status_code == 200
    assert response.json()["message"] == "Molecule uploaded successfully"
"""
}

for d in directories:
    os.makedirs(os.path.join(base_dir, d), exist_ok=True)

for filepath, content in files.items():
    with open(os.path.join(base_dir, filepath), 'w', encoding='utf-8') as f:
        f.write(content)

print("Generated all files.")
