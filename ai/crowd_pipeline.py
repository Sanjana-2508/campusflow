import csv
import os
import json
import time
from datetime import datetime

from crowd_generator import generate_crowd
from crowd_classifier import classify_crowd


# Load campus locations
with open("data/campus_locations.json", "r") as file:
    locations = json.load(file)


# CSV file location
history_file = "data/crowd_history.csv"


# Create CSV file if it doesn't exist
if not os.path.exists(history_file):
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


# Remember previous crowd count
previous_counts = {}


# Continuous simulation
while True:

    print("\n" + "=" * 50)
    print("CAMPUSFLOW - LIVE CROWD UPDATE")
    print(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 50)

    for location in locations:

        # Location ID
        location_id = location["location_id"]

        # Get previous crowd count
        previous_count = previous_counts.get(location_id)

        # Generate new crowd count
        people_count = generate_crowd(
            location["capacity"],
            previous_count
        )

        # Remember this count for the next update
        previous_counts[location_id] = people_count

        # Calculate crowd level
        percentage, crowd_level = classify_crowd(
            people_count,
            location["capacity"]
        )

        # Current timestamp
        recorded_at = datetime.now().isoformat()

        # Save data to CSV
        with open(history_file, "a", newline="") as file:
            writer = csv.writer(file)

            writer.writerow([
                location["location_id"],
                location["location_type"],
                location["location"],
                people_count,
                location["capacity"],
                crowd_level,
                "SIMULATED",
                recorded_at
            ])

        # Display result
        print(
            f"{location['location']:<15} "
            f"{people_count:>3}/{location['capacity']}  "
            f"{percentage:>5.1f}%  "
            f"{crowd_level}"
        )

    print("\nNext update in 10 seconds...")

    time.sleep(10)