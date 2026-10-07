import csv
from collections import defaultdict


history_file = "data/crowd_history.csv"


# Store data for each location
location_data = defaultdict(list)


# Read historical crowd data
with open(history_file, "r") as file:

    reader = csv.DictReader(file)

    for row in reader:

        location = row["location"]

        people_count = int(row["people_count"])

        location_data[location].append(people_count)


# Analyze each location
print("\n" + "=" * 50)
print("CAMPUSFLOW - CROWD DATA ANALYSIS")
print("=" * 50)

for location, counts in location_data.items():

    total = sum(counts)

    average = total / len(counts)

    minimum = min(counts)

    maximum = max(counts)

    print(f"\nLocation: {location}")
    print(f"Readings: {len(counts)}")
    print(f"Average crowd: {average:.1f}")
    print(f"Minimum crowd: {minimum}")
    print(f"Maximum crowd: {maximum}")