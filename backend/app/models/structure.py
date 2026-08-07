from sqlalchemy import Column, String, Text, JSON, DateTime
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
