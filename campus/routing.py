import heapq
import json
from pathlib import Path

CAMPUS = Path(__file__).resolve().parent
WALKING_SPEED = 75  # metres per minute (from the spec)

# Extra "pretend metres" added when a place is crowded.
# Tune these during testing (the spec says settings should not be hard-coded for good).
CROWD_PENALTY_M = {"LOW": 0, "MEDIUM": 20, "HIGH": 80}
CROWD_ORDER = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}


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


def find_route(start, end, crowd=None):
    """Shortest walking route between two node IDs, for example find_route("P2", "B7").

    crowd is optional: a dict like {"B3": "HIGH", "B5": "LOW"}.
    If given, crowded places cost extra, so the route avoids them when it can.
    """
    nodes, graph = load_graph()
    crowd = crowd or {}

    if start not in nodes or end not in nodes:
        return None

    # Each item: (cost so far, real distance so far, current node, route so far)
    # "cost" = distance + crowd penalty. It decides which route wins.
    # "distance" = the real metres we show to the user.
    queue = [(0, 0, start, [start])]
    visited = set()

    while queue:
        cost, distance, current, route = heapq.heappop(queue)  # cheapest first
        if current in visited:
            continue
        visited.add(current)

        if current == end:
            result = {
                "node_ids": route,
                "labels": [nodes[n]["label"] for n in route],
                "coordinates": [[nodes[n]["latitude"], nodes[n]["longitude"]] for n in route],
                "distance_m": distance,
                "walk_minutes": round(distance / WALKING_SPEED),
            }
            # Worst crowd level anywhere on the route (spec rule T7)
            levels = [crowd[n] for n in route if n in crowd]
            result["crowd_level"] = (
                max(levels, key=lambda lv: CROWD_ORDER[lv]) if levels else None
            )
            return result

        for neighbour, length in graph[current]:
            if neighbour not in visited:
                penalty = CROWD_PENALTY_M.get(crowd.get(neighbour), 0)
                heapq.heappush(
                    queue,
                    (cost + length + penalty, distance + length, neighbour, route + [neighbour]),
                )

    return None  # no route found


if __name__ == "__main__":
    # 1. Normal route (no crowd info)
    normal = find_route("P2", "B9")
    print("Normal :", " -> ".join(normal["labels"]), f"| {normal['distance_m']} m")

    # 2. Same trip, but one place on the route is HIGH crowd
    # Pick a middle node from the normal route and mark it crowded
    middle = normal["node_ids"][len(normal["node_ids"]) // 2]
    smart = find_route("P2", "B9", crowd={middle: "HIGH"})
    print("Crowd  :", " -> ".join(smart["labels"]), f"| {smart['distance_m']} m",
          f"| worst crowd: {smart['crowd_level']}")