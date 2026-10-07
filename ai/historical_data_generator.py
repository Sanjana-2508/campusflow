import csv
import json
import random
from datetime import datetime, timedelta

from crowd_classifier import classify_crowd


# Load campus locations
with open("data/campus_locations.json", "r") as file:
    locations = json.load(file)


history_file = "data/crowd_history.csv"


# Generate historical crowd based on hour
def generate_historical_crowd(capacity, hour):

    # Time-of-day pattern
    if 8 <= hour < 10:
        base_percentage = 0.30

    elif 10 <= hour < 12:
        base_percentage = 0.50

    elif 12 <= hour < 14:
        base_percentage = 0.75

    elif 14 <= hour < 16:
        base_percentage = 0.85

    elif 16 <= hour < 18:
        base_percentage = 0.55

    else:
        base_percentage = 0.25

    # Random variation
    variation = random.uniform(-0.10, 0.10)

    percentage = base_percentage + variation

    # Keep between 0 and 100%
    percentage = max(0, min(1, percentage))

    people_count = int(capacity * percentage)

    return people_count


# Start date for historical data
start_time = datetime.now() - timedelta(days=7)


# Number of records
records_per_location = 100


# Create CSV
with open(history_file, "w", newline="") as file:

    writer = csv.writer(file)

    writer.writerow([
        "location_id",
        "location_type",
        "location",
        "people_count",
        "capacity",
        "crowd_level",
        "source",
        "recorded_at"
    ])

    # Generate data
    for location in locations:

        for i in range(records_per_location):

            # Spread records across different hours
            recorded_time = start_time + timedelta(
                minutes=i * 60
            )

            hour = recorded_time.hour

            # Generate crowd
            people_count = generate_historical_crowd(
                location["capacity"],
                hour
            )

            # Classify crowd
            percentage, crowd_level = classify_crowd(
                people_count,
                location["capacity"]
            )

            # Save row
            writer.writerow([
                location["location_id"],
                location["location_type"],
                location["location"],
                people_count,
                location["capacity"],
                crowd_level,
                "SIMULATED",
                recorded_time.isoformat()
            ])


print("Historical dataset created successfully!")

print(f"Locations: {len(locations)}")

print(f"Records per location: {records_per_location}")

print(
    f"Total records: "
    f"{len(locations) * records_per_location}"
)

print(f"Saved to: {history_file}")