from sqlalchemy import Column, Integer, String, Enum, DateTime
from sqlalchemy.sql import func

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), nullable=False, unique=True)
    phone = Column(String(20), unique=True, nullable=True)
    password_hash = Column(String(255), nullable=False)

    role = Column(
        Enum("STUDENT", "FACULTY_STAFF", "ADMIN"),
        nullable=False,
        default="STUDENT",
    )

    department = Column(String(100), nullable=True)

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
    )