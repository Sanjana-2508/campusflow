import pandas as pd
import json
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
# 3. TRAIN MODEL
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
# 5. PREDICTION SETTINGS
# ==========================================

prediction_hour = 14
prediction_day = 0

predictions = []


# ==========================================
# 6. GENERATE PREDICTIONS
# ==========================================

for location in locations:

    location_id = location["location_id"]
    location_name = location["location"]
    location_type = location["location_type"]
    capacity = location["capacity"]

    sample = pd.DataFrame(
        [[
            location_id,
            capacity,
            prediction_hour,
            prediction_day
        ]],
        columns=features
    )

    predicted_count = model.predict(sample)[0]

    predicted_count = round(predicted_count)

    occupancy = (predicted_count / capacity) * 100

    # Crowd classification
    if occupancy <= 40:
        crowd_level = "LOW"

    elif occupancy <= 70:
        crowd_level = "MEDIUM"

    else:
        crowd_level = "HIGH"


    # ==========================================
    # 7. CREATE CAMPUSFLOW DATA CONTRACT
    # ==========================================

    prediction = {
        "location_id": location_id,
        "location_type": location_type,
        "location": location_name,
        "people_count": predicted_count,
        "capacity": capacity,
        "crowd_level": crowd_level,
        "source": "AI_PREDICTION",
        "recorded_at": datetime.now().isoformat()
    }

    predictions.append(prediction)


# ==========================================
# 8. SAVE JSON
# ==========================================

with open(
    "data/crowd_predictions.json",
    "w"
) as file:

    json.dump(
        predictions,
        file,
        indent=4
    )


# ==========================================
# 9. DISPLAY
# ==========================================

print("\n" + "=" * 60)
print("CAMPUSFLOW - AI PREDICTION OUTPUT")
print("=" * 60)

for prediction in predictions:

    print(
        f"{prediction['location']:<15} "
        f"{prediction['people_count']:>3}/"
        f"{prediction['capacity']:<3} "
        f"{prediction['crowd_level']}"
    )

print("\nJSON saved to:")
print("data/crowd_predictions.json")