from fastapi import FastAPI

from app.routers.auth import router as auth_router
from app.routers.buildings import router as buildings_router
from app.routers.facilities import router as facilities_router
from app.routers.gates import router as gates_router
from app.routers.parking import router as parking_router

app = FastAPI(
    title="CampusFlow API",
    version="1.0.0",
)

app.include_router(auth_router)
app.include_router(buildings_router)
app.include_router(facilities_router)
app.include_router(gates_router)
app.include_router(parking_router)


@app.get("/")
def root():
    return {
        "message": "CampusFlow backend is running"
    }