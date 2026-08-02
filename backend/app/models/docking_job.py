from sqlalchemy import Column, String, Text, JSON, DateTime
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
