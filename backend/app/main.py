from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI

from app.routers.auth import router as auth_router
from app.routers.buildings import router as buildings_router
from app.routers.crowd import router as crowd_router
from app.routers.facilities import router as facilities_router
from app.routers.gates import router as gates_router
from app.routers.navigation import router as navigation_router
from app.routers.parking import router as parking_router
from app.services.parking import mark_expired_reservations_no_show

scheduler = BackgroundScheduler()
scheduler.add_job(
    mark_expired_reservations_no_show,
    "interval",
    seconds=60,
    id="parking_no_show_scheduler",
    replace_existing=True,
)

app = FastAPI(
    title="CampusFlow API",
    version="1.0.0",
)


@app.on_event("startup")
def startup_event():
    if not scheduler.running:
        scheduler.start()


@app.on_event("shutdown")
def shutdown_event():
    if scheduler.running:
        scheduler.shutdown(wait=False)


app.include_router(auth_router)
app.include_router(buildings_router)
app.include_router(crowd_router)
app.include_router(facilities_router)
app.include_router(gates_router)
app.include_router(navigation_router)
app.include_router(parking_router)


@app.get("/")
def root():
    return {
        "message": "CampusFlow backend is running"
    }