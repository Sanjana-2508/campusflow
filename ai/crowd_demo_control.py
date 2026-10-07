import json
from datetime import datetime


# ==========================================
# LOAD CAMPUS LOCATIONS
# ==========================================

with open("data/campus_locations.json", "r") as file:
    locations = json.load(file)


# ==========================================
# CROWD LEVEL SETTINGS
# ==========================================

crowd_percentages = {
    "LOW": 0.30,
    "MEDIUM": 0.60,
    "HIGH": 0.90
}


# ==========================================
# DISPLAY LOCATIONS
# ==========================================

print("\n" + "=" * 50)
print("CAMPUSFLOW - CROWD DEMO CONTROL")
print("=" * 50)

print("\nAvailable locations:")

for location in locations:
    print(
        f"{location['location_id']}. "
        f"{location['location']}"
    )


# ==========================================
# USER INPUT
# ==========================================

location_id = int(
    input("\nEnter location ID: ")
)

crowd_level = input(
    "Enter crowd level (LOW/MEDIUM/HIGH): "
).upper()


# ==========================================
# VALIDATION
# ==========================================

if crowd_level not in crowd_percentages:
    print("\nInvalid crowd level!")
    print("Use LOW, MEDIUM or HIGH.")
    exit()


selected_location = None

for location in locations:
    if location["location_id"] == location_id:
        selected_location = location
        break


if selected_location is None:
    print("\nInvalid location ID!")
    exit()


# ==========================================
# GENERATE PEOPLE COUNT
# ==========================================

capacity = selected_location["capacity"]

percentage = crowd_percentages[crowd_level]

people_count = round(
    capacity * percentage
)


# ==========================================
# CREATE CROWD DATA
# ==========================================

crowd_data = {
    "location_id": selected_location["location_id"],
    "location_type": selected_location["location_type"],
    "location": selected_location["location"],
    "people_count": people_count,
    "capacity": capacity,
    "crowd_level": crowd_level,
    "source": "DEMO_CONTROL",
    "recorded_at": datetime.now().isoformat()
}


# ==========================================
# SAVE RESULT
# ==========================================

with open(
    "data/demo_crowd.json",
    "w"
) as file:

    json.dump(
        crowd_data,
        file,
        indent=4
    )


# ==========================================
# DISPLAY RESULT
# ==========================================

print("\n" + "=" * 50)
print("CROWD UPDATED")
print("=" * 50)

print(
    f"\nLocation: {selected_location['location']}"
)

print(
    f"People: {people_count}/{capacity}"
)

print(
    f"Occupancy: {percentage * 100:.0f}%"
)

print(
    f"Crowd Level: {crowd_level}"
)

print("\nSaved to:")
print("data/demo_crowd.json")