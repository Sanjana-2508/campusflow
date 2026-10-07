import heapq
import json
from pathlib import Path

CAMPUS = Path(__file__).resolve().parent
WALKING_SPEED = 75  # metres per minute (from the spec)


def load_graph():
    with open(CAMPUS / "paths/nodes.json", encoding="utf-8") as f:
        nodes = {n["id"]: n for n in json.load(f)}
    with open(CAMPUS / "paths/paths.json", encoding="utf-8") as f:
        paths = json.load(f)

    # graph[A] = list of (neighbour, length) for every walkway from A
    graph = {node_id: [] for node_id in nodes}
    for p in paths:
        graph[p["from_node"]].append((p["to_node"], p["length_m"]))
        if p["bidirectional"]:
            graph[p["to_node"]].append((p["from_node"], p["length_m"]))
    return nodes, graph


def find_route(start, end):
    """Shortest walking route between two node IDs, for example find_route("P2", "B7")."""
    nodes, graph = load_graph()

    if start not in nodes or end not in nodes:
        return None

    # Each item: (distance so far, current node, route so far)
    queue = [(0, start, [start])]
    visited = set()

    while queue:
        distance, current, route = heapq.heappop(queue)  # takes the shortest one
        if current in visited:
            continue
        visited.add(current)

        if current == end:
            return {
                "node_ids": route,
                "labels": [nodes[n]["label"] for n in route],
                "coordinates": [[nodes[n]["latitude"], nodes[n]["longitude"]] for n in route],
                "distance_m": distance,
                "walk_minutes": round(distance / WALKING_SPEED),
            }

        for neighbour, length in graph[current]:
            if neighbour not in visited:
                heapq.heappush(queue, (distance + length, neighbour, route + [neighbour]))

    return None  # no route found


if __name__ == "__main__":
    result = find_route("P2", "B9")
    if result is None:
        print("No route found")
    else:
        print(" -> ".join(result["labels"]))
        print(f"{result['distance_m']} m, about {result['walk_minutes']} min")