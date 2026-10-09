import json
from pathlib import Path

from routing import find_route

CAMPUS = Path(__file__).resolve().parent

# ---- Settings (from the spec). Change them here, not inside the code below ----
CONFIG = {
    "weight_availability": 0.4,
    "weight_distance": 0.3,
    "weight_crowd": 0.3,
    "max_spaces": 20,      # 20 or more free spaces = full availability score
    "max_walk_min": 15,    # 15 or more minutes of walking = zero distance score
}

CROWD_SCORE = {"LOW": 1.0, "MEDIUM": 0.5, "HIGH": 0.0}
CROWD_ORDER = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}

# ---- FAKE data for now. Later it comes from Person 2 (reservations) and Person 3 (crowd) ----
# (student_held, staff_held) for each zone and vehicle type
FAKE_HELD = {
    "P1": {"CAR": (28, 4), "TWO_WHEELER": (5, 1)},
    "P2": {"CAR": (16, 2), "TWO_WHEELER": (20, 5)},
}

# crowd level for each node
FAKE_CROWD = {"P1": "HIGH", "B1": "LOW", "B3": "MEDIUM"}


def spaces_available(capacity, staff_reserved, student_held, staff_held, role):
    """The formula from Section 6.2 of the spec."""
    all_held = student_held + staff_held
    if role == "STUDENT":
        free = min(capacity - staff_reserved - student_held, capacity - all_held)
    else:  # FACULTY_STAFF or ADMIN
        free = capacity - all_held
    return max(0, free)


def worst_crowd(node_ids, crowd_data):
    """Worst crowd level on the route (HIGH is worse than MEDIUM, MEDIUM is worse than LOW)."""
    worst = "LOW"
    for node_id in node_ids:
        level = crowd_data.get(node_id, "LOW")
        if CROWD_ORDER[level] > CROWD_ORDER[worst]:
            worst = level
    return worst


def recommend(destination_node, vehicle_type, role, held=FAKE_HELD, crowd=FAKE_CROWD):
    with open(CAMPUS / "parking/parking_zones.json", encoding="utf-8") as f:
        zones = json.load(f)

    options = []
    for zone in zones:
        node_id = f"P{zone['id']}"

        # Filter 1: closed zones are skipped
        if zone["status"] != "OPEN":
            continue

        # Pick the right numbers for the vehicle type
        if vehicle_type == "CAR":
            capacity, reserved = zone["car_capacity"], zone["staff_reserved_car"]
        else:
            capacity, reserved = zone["bike_capacity"], zone["staff_reserved_bike"]
        student_held, staff_held = held.get(node_id, {}).get(vehicle_type, (0, 0))
        free = spaces_available(capacity, reserved, student_held, staff_held, role)

        # Filter 2: full zones are skipped
        if free == 0:
            continue

        # Filter 3: zones with no walking route are skipped
        route = find_route(node_id, destination_node)
        if route is None:
            continue

        # Scores (each between 0 and 1)
        availability_score = min(free, CONFIG["max_spaces"]) / CONFIG["max_spaces"]
        distance_score = 1 - min(route["walk_minutes"], CONFIG["max_walk_min"]) / CONFIG["max_walk_min"]
        crowd_level = worst_crowd(route["node_ids"], crowd)
        crowd_score = CROWD_SCORE[crowd_level]

        total = (CONFIG["weight_availability"] * availability_score
                 + CONFIG["weight_distance"] * distance_score
                 + CONFIG["weight_crowd"] * crowd_score)

        options.append({
            "parking_zone_id": zone["id"],
            "name": zone["name"],
            "spaces_available": free,
            "walk_minutes": route["walk_minutes"],
            "distance_m": route["distance_m"],
            "crowd_level": crowd_level,
            "score": round(total, 2),
            "route": route,
        })

    if not options:
        return None

    options.sort(key=lambda o: o["score"], reverse=True)  # best first
    best = options[0]
    best["reason"] = "Best mix of free spaces, short walk and low crowd"
    return {"recommended": best, "alternatives": options[1:]}


if __name__ == "__main__":
    for role in ["STUDENT", "FACULTY_STAFF"]:
        print(f"--- {role} ---")
        result = recommend("B7", "CAR", role)
        if result is None:
            print("No parking available")
            continue
        for option in [result["recommended"]] + result["alternatives"]:
            print(f"{option['name']}: score {option['score']} | "
                  f"{option['spaces_available']} spaces | "
                  f"{option['walk_minutes']} min walk | {option['crowd_level']} crowd")
        print("Recommended:", result["recommended"]["name"])