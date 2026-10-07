import json
import pandas as pd
from datetime import datetime
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split


# ==========================================
# 1. LOAD HISTORICAL DATA
# ==========================================

data = pd.read_csv("data/crowd_history.csv")

data["recorded_at"] = pd.to_datetime(data["recorded_at"])

data["hour"] = data["recorded_at"].dt.hour
data["day_of_week"] = data["recorded_at"].dt.dayofweek


# ==========================================
# 2. FEATURES
# ==========================================

features = [
    "location_id",
    "capacity",
    "hour",
    "day_of_week"
]

X = data[features]
y = data["people_count"]


# ==========================================
# 3. TRAIN AI MODEL
# ==========================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)

model = RandomForestRegressor(
    n_estimators=100,
    random_state=42
)

model.fit(X_train, y_train)


# ==========================================
# 4. LOAD LOCATIONS
# ==========================================

with open("data/campus_locations.json", "r") as file:
    locations = json.load(file)


# ==========================================
# 5. CROWD CLASSIFICATION
# ==========================================

def classify_crowd(people_count, capacity):

    percentage = (people_count / capacity) * 100

    if percentage <= 40:
        level = "LOW"

    elif percentage <= 70:
        level = "MEDIUM"

    else:
        level = "HIGH"

    return percentage, level


# ==========================================
# 6. AI PREDICTION FUNCTION
# ==========================================

def predict_crowd(
    location,
    hour,
    day_of_week
):

    sample = pd.DataFrame(
        [[
            location["location_id"],
            location["capacity"],
            hour,
            day_of_week
        ]],
        columns=features
    )

    predicted_count = model.predict(sample)[0]

    predicted_count = round(predicted_count)

    predicted_count = max(
        0,
        min(predicted_count, location["capacity"])
    )

    percentage, crowd_level = classify_crowd(
        predicted_count,
        location["capacity"]
    )

    return {
        "location_id": location["location_id"],
        "location_type": location["location_type"],
        "location": location["location"],
        "people_count": predicted_count,
        "capacity": location["capacity"],
        "crowd_level": crowd_level,
        "occupancy_percentage": round(
            percentage,
            1
        ),
        "source": "AI_PREDICTION"
    }


# ==========================================
# 7. RUN AI CROWD ENGINE
# ==========================================

if __name__ == "__main__":

    print("\nAvailable locations:")

    for location in locations:
        print(
            f"{location['location_id']}. "
            f"{location['location']}"
        )

    # ==========================================
    # LOCATION INPUT
    # ==========================================

    selected_location_id = int(
        input("\nEnter location ID: ")
    )

    # ==========================================
    # VALIDATE LOCATION
    # ==========================================

    valid_location_ids = [
        location["location_id"]
        for location in locations
    ]

    if selected_location_id not in valid_location_ids:
        print("\nInvalid location ID!")
        exit()

    # ==========================================
    # TIME INPUT
    # ==========================================

    prediction_hour = int(
        input("Enter hour (0-23): ")
    )

    # ==========================================
    # VALIDATE HOUR
    # ==========================================

    if prediction_hour < 0 or prediction_hour > 23:
        print("\nInvalid hour! Enter a value from 0 to 23.")
        exit()

    # ==========================================
    # DAY INPUT
    # ==========================================

    prediction_day = int(
        input(
            "Enter day of week "
            "(0=Monday, 6=Sunday): "
        )
    )

    # ==========================================
    # VALIDATE DAY
    # ==========================================

    if prediction_day < 0 or prediction_day > 6:
        print("\nInvalid day! Enter a value from 0 to 6.")
        exit()

    # ==========================================
    # DISPLAY HEADER
    # ==========================================

    print("\n" + "=" * 65)
    print("CAMPUSFLOW - AI CROWD ENGINE")
    print("=" * 65)

    print(
        f"\nPrediction time: "
        f"{prediction_hour}:00"
    )

    print("-" * 65)

    # ==========================================
    # STORE RESULTS
    # ==========================================

    results = []

    # ==========================================
    # PREDICT SELECTED LOCATION
    # ==========================================

    for location in locations:

        if location["location_id"] != selected_location_id:
            continue

        result = predict_crowd(
            location,
            prediction_hour,
            prediction_day
        )

        # ==========================================
        # API-COMPATIBLE RESULT
        # ==========================================

        api_result = {
            "location_id": result["location_id"],
            "location_type": result["location_type"],
            "location": result["location"],
            "people_count": result["people_count"],
            "capacity": result["capacity"],
            "crowd_level": result["crowd_level"],
            "source": result["source"],
            "recorded_at": datetime.now().isoformat()
        }

        results.append(api_result)

        # ==========================================
        # DISPLAY RESULT
        # ==========================================

        print(
            f"{result['location']:<15} "
            f"{result['people_count']:>3}/"
            f"{result['capacity']:<3} "
            f"{result['occupancy_percentage']:>5.1f}%  "
            f"{result['crowd_level']:<6} "
            f"{result['source']}"
        )

    # ==========================================
    # SAVE AI PREDICTION
    # ==========================================

    with open(
        "data/ai_crowd_predictions.json",
        "w"
    ) as file:

        json.dump(
            results,
            file,
            indent=4
        )

    print("-" * 65)
    print("AI crowd engine working successfully!")

    print("\nJSON saved to:")
    print("data/ai_crowd_predictions.json")