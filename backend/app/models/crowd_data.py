from sqlalchemy import Column, Integer, String, DateTime, Enum

from app.db.base import Base


class CrowdData(Base):
    __tablename__ = "crowd_data"

    id = Column(Integer, primary_key=True, autoincrement=True)

    location_type = Column(String(50), nullable=False)
    location_id = Column(Integer, nullable=False)

    people_count = Column(Integer, nullable=False)
    capacity = Column(Integer, nullable=False)

    crowd_level = Column(
        Enum("LOW", "MEDIUM", "HIGH"),
        nullable=False,
    )

    source = Column(
        Enum("SIMULATED", "YOLO"),
        nullable=False,
    )

    recorded_at = Column(
        DateTime,
        nullable=False,
    )