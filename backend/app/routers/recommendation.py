from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.recommendation import ParkingRecommendationsResponse
from app.services.recommendation import recommend_parking_zones

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


@router.get(
    "/parking",
    response_model=ParkingRecommendationsResponse,
)
def get_parking_recommendations(
    source_node_id: int = Query(..., gt=0),
    vehicle_type: str = Query(..., description="CAR or TWO_WHEELER"),
    requested_at: datetime | None = Query(
        default=None,
        description="Optional requested arrival time in UTC",
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return recommend_parking_zones(
        db,
        source_node_id=source_node_id,
        vehicle_type=vehicle_type,
        user_role=current_user.role,
        requested_at=requested_at,
    )
