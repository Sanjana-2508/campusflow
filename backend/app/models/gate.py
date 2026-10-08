from sqlalchemy import Column, Integer, String, DECIMAL, Text

from app.db.base import Base


class Gate(Base):
    __tablename__ = "gates"

    id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(String(150), nullable=False)

    lat = Column(DECIMAL(10, 7), nullable=False)
    lng = Column(DECIMAL(10, 7), nullable=False)

    description = Column(Text, nullable=True)