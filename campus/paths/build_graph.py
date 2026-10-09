import json
import math
from pathlib import Path

CAMPUS = Path(__file__).resolve().parent.parent  # the campus/ folder


def load(relative_path):
    with open(CAMPUS / relative_path, encoding="utf-8") as f:
        return json.load(f)


def distance_m(lat1, lon1, lat2, lon2):
    # straight-line distance in metres between two coordinates
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


# 1. Make nodes from your three files
nodes = []
for b in load("buildings/buildings.json"):
    nodes.append({"id": f"B{b['id']}", "label": b["name"].strip(), "node_type": "BUILDING",
                  "latitude": b["latitude"], "longitude": b["longitude"]})
for g in load("gates/gates.json"):
    nodes.append({"id": f"G{g['id']}", "label": g["name"].strip(), "node_type": "GATE",
                  "latitude": g["latitude"], "longitude": g["longitude"]})
for p in load("parking/parking_zones.json"):
    nodes.append({"id": f"P{p['id']}", "label": p["name"].strip(), "node_type": "PARKING",
                  "latitude": p["latitude"], "longitude": p["longitude"]})

by_id = {n["id"]: n for n in nodes}

# 2. YOU decide which places are connected by a walkway.
#    Change this list to match the real paths on your campus.
connections = [
    ("G1", "P2"),   # BMSSA gate  - Parking B
    ("G2", "P2"),   # BMSIT gate  - Parking B
    ("P2", "B1"),   # Parking B   - B.S.Narayan Block
    ("P2", "B8"),   # Parking B   - Kuteera canteen
    ("B1", "B4"),   # B.S.Narayan - NCC Office
    ("B4", "B2"),   # NCC Office  - Lab Block
    ("B1", "B3"),   # B.S.Narayan - Academic Block
    ("B3", "B6"),   # Academic    - Bmsit canteen
    ("B6", "B5"),   # Canteen     - Library
    ("B3", "B9"),   # Academic    - Amphitheatre
    ("B5", "B7"),   # Library     - Architecture
    ("B7", "B8"),   # Architecture - Kuteera canteen
    ("B1", "B7"),   # B.S.Narayan - Architecture (a loop)
    ("P1", "B7"),   # Parking A: add its connections once its coordinates are fixed
]

# 3. Make paths. Real walkways bend, so we multiply the straight line by 1.3
paths = []
for i, (a, b) in enumerate(connections, start=1):
    na, nb = by_id[a], by_id[b]
    length = distance_m(na["latitude"], na["longitude"], nb["latitude"], nb["longitude"]) * 1.3
    length = round(length)
    if length > 1000:
        print(f"WARNING: {a} to {b} is {length} m. Check the coordinates!")
    paths.append({"id": i, "name": f"{na['label']} - {nb['label']}",
                  "from_node": a, "to_node": b, "length_m": length, "bidirectional": True})

# 4. Check: is every node connected?
used = {n for pair in connections for n in pair}
for n in nodes:
    if n["id"] not in used:
        print(f"WARNING: {n['id']} ({n['label']}) has no path yet")

with open(CAMPUS / "paths/nodes.json", "w", encoding="utf-8") as f:
    json.dump(nodes, f, indent=2)
with open(CAMPUS / "paths/paths.json", "w", encoding="utf-8") as f:
    json.dump(paths, f, indent=2)

print(f"Done: {len(nodes)} nodes, {len(paths)} paths")