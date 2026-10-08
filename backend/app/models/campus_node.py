from sqlalchemy import Column, Integer, String, DECIMAL

from app.db.base import Base


class CampusNode(Base):
    __tablename__ = "campus_nodes"

    id = Column(Integer, primary_key=True, autoincrement=True)

    label = Column(String(150), nullable=False)
    node_type = Column(String(50), nullable=False)

    ref_id = Column(Integer, nullable=True)

    lat = Column(DECIMAL(10, 7), nullable=False)
    lng = Column(DECIMAL(10, 7), nullable=False)