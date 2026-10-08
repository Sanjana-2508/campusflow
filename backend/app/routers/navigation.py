from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.navigation import NavigationRouteResponse
from app.services.navigation import find_shortest_route

router = APIRouter(prefix="/navigation", tags=["navigation"])


@router.get("/route", response_model=NavigationRouteResponse)
def get_navigation_route(
    source_node_id: int = Query(..., description="Source campus node id"),
    destination_node_id: int = Query(..., description="Destination campus node id"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    route = find_shortest_route(db, source_node_id, destination_node_id)
    return route
