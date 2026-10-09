from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from routing import find_route
from recommend import recommend

router = APIRouter()


class RecommendRequest(BaseModel):
    destination_id: str          # node id like "B7" (we must agree with Person 2 on ids)
    vehicle_type: str = "CAR"    # CAR or TWO_WHEELER


@router.get("/navigation/route")
def get_route(to: str, from_node: str = Query(..., alias="from")):
    route = find_route(from_node, to)
    if route is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NO_ROUTE", "message": "No walking route found"}},
        )
    return route


@router.post("/recommendations")
def get_recommendation(body: RecommendRequest, role: str = "STUDENT"):
    # TEMPORARY: role comes from the URL for now.
    # Person 2 should replace it with the role of the logged-in user.
    # Person 2 should also pass real held= and crowd= data here.
    result = recommend(body.destination_id, body.vehicle_type, role)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NO_PARKING", "message": "No parking available"}},
        )
    return result