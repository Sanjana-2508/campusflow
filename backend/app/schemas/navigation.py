from pydantic import BaseModel, ConfigDict


class NavigationRouteResponse(BaseModel):
    source_node_id: int
    destination_node_id: int
    path_node_ids: list[int]
    path_node_names: list[str]
    total_distance_meters: float
    estimated_walking_time_minutes: float

    model_config = ConfigDict(from_attributes=True)
