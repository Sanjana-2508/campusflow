from __future__ import annotations

import heapq
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.campus_node import CampusNode
from app.models.campus_path import CampusPath


def _get_node(db: Session, node_id: int) -> CampusNode:
    node = db.get(CampusNode, node_id)
    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campus node {node_id} not found",
        )
    return node


def find_shortest_route(
    db: Session,
    source_node_id: int,
    destination_node_id: int,
) -> dict[str, Any]:
    if source_node_id == destination_node_id:
        source = _get_node(db, source_node_id)
        return {
            "source_node_id": source.id,
            "destination_node_id": source.id,
            "path_node_ids": [source.id],
            "path_node_names": [source.label],
            "total_distance_meters": 0.0,
            "estimated_walking_time_minutes": 0.0,
        }

    source = _get_node(db, source_node_id)
    destination = _get_node(db, destination_node_id)

    graph: dict[int, list[tuple[int, int]]] = {}

    paths = db.execute(select(CampusPath)).scalars().all()
    for path in paths:
        if path.from_node_id is None or path.to_node_id is None:
            continue
        if path.bidirectional:
            graph.setdefault(path.from_node_id, []).append((path.to_node_id, int(path.length_m or 0)))
            graph.setdefault(path.to_node_id, []).append((path.from_node_id, int(path.length_m or 0)))
        else:
            graph.setdefault(path.from_node_id, []).append((path.to_node_id, int(path.length_m or 0)))

    distances: dict[int, float] = {source.id: 0.0}
    previous: dict[int, int | None] = {source.id: None}
    heap: list[tuple[float, int]] = [(0.0, source.id)]

    while heap:
        current_distance, current_node_id = heapq.heappop(heap)
        if current_distance > distances.get(current_node_id, float("inf")):
            continue
        if current_node_id == destination.id:
            break

        for neighbor_id, path_length in graph.get(current_node_id, []):
            new_distance = current_distance + float(path_length)
            if new_distance < distances.get(neighbor_id, float("inf")):
                distances[neighbor_id] = new_distance
                previous[neighbor_id] = current_node_id
                heapq.heappush(heap, (new_distance, neighbor_id))

    if destination.id not in distances:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No route exists between the selected campus nodes",
        )

    path_ids: list[int] = []
    node_id: int | None = destination.id
    while node_id is not None:
        path_ids.append(node_id)
        node_id = previous.get(node_id)
    path_ids.reverse()

    path_nodes = db.execute(select(CampusNode).where(CampusNode.id.in_(path_ids))).scalars().all()
    node_map = {node.id: node for node in path_nodes}
    ordered_names = [node_map[nid].label for nid in path_ids]

    total_distance = float(distances[destination.id])
    walking_speed_m_per_min = 75.0
    estimated_walking_time = total_distance / walking_speed_m_per_min

    return {
        "source_node_id": source.id,
        "destination_node_id": destination.id,
        "path_node_ids": path_ids,
        "path_node_names": ordered_names,
        "total_distance_meters": total_distance,
        "estimated_walking_time_minutes": estimated_walking_time,
    }
