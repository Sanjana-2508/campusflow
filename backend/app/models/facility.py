from sqlalchemy import Column, Integer, String, DECIMAL, Text, ForeignKey

from app.db.base import Base


class Facility(Base):
    __tablename__ = "facilities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    building_id = Column(
        Integer,
        ForeignKey("buildings.id"),
        nullable=True,
    )
    name = Column(String(150), nullable=False)
    category = Column(String(100), nullable=True)
    lat = Column(DECIMAL(10, 7), nullable=False)
    lng = Column(DECIMAL(10, 7), nullable=False)
    description = Column(Text, nullable=True)