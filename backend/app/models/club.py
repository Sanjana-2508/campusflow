from sqlalchemy import Column, Integer, String, Text, Enum, ForeignKey

from app.db.base import Base


class Club(Base):
    __tablename__ = "clubs"

    id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)

    owner_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
    )

    verification_status = Column(
        Enum("PENDING", "APPROVED", "REJECTED"),
        nullable=False,
        default="PENDING",
    )