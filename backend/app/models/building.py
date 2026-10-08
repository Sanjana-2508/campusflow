from sqlalchemy import Column, Integer, String, DECIMAL, Text

from app.db.base import Base


class Building(Base):
    __tablename__ = "buildings"

    id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(String(150), nullable=False)
    type = Column(String(50), nullable=True)

    lat = Column(DECIMAL(10, 7), nullable=False)
    lng = Column(DECIMAL(10, 7), nullable=False)

    description = Column(Text, nullable=True)