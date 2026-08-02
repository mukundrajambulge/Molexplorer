from sqlalchemy import Column, String, DateTime
from datetime import datetime
import uuid
from app.models.base import Base

class Library(Base):
    __tablename__ = "libraries"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, index=True)
    description = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
