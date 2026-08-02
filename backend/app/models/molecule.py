from sqlalchemy import Column, String, Text, ForeignKey, JSON, DateTime
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
