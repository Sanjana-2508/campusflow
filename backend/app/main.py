from fastapi import FastAPI
from sqlalchemy import text
from app.db.base import Base
from app.models.user import User

from app.db.session import engine

app = FastAPI(title="CampusFlow API")


@app.get("/")
def root():
    return {"message": "CampusFlow backend is running"}


@app.get("/api/test-db")
def test_db():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT DATABASE()"))
        database_name = result.scalar()

    return {
        "message": "Database connection successful",
        "database": database_name
    }