from sqlalchemy import Column, Integer, String, DECIMAL, Boolean

from app.db.base import Base


class CampusPath(Base):
    __tablename__ = "campus_paths"

    id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(String(150), nullable=True)

    from_node_id = Column(Integer, nullable=False)
    to_node_id = Column(Integer, nullable=False)

    length_m = Column(DECIMAL(10, 2), nullable=False)

    bidirectional = Column(Boolean, nullable=False, default=True)

    crowd_location_id = Column(Integer, nullable=True)