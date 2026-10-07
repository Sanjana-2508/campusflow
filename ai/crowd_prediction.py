import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error


# ==========================================
# 1. LOAD HISTORICAL CROWD DATA
# ==========================================

data = pd.read_csv("data/crowd_history.csv")

data["recorded_at"] = pd.to_datetime(data["recorded_at"])


# ==========================================
# 2. CREATE TIME FEATURES
# ==========================================

data["hour"] = data["recorded_at"].dt.hour
data["day_of_week"] = data["recorded_at"].dt.dayofweek


# ==========================================
# 3. SELECT FEATURES
# ==========================================

features = [
    "location_id",
    "capacity",
    "hour",
    "day_of_week"
]

target = "people_count"

X = data[features]
y = data[target]


# ==========================================
# 4. SPLIT DATA
# ==========================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)


# ==========================================
# 5. CREATE AI MODEL
# ==========================================

model = RandomForestRegressor(
    n_estimators=100,
    random_state=42
)


# ==========================================
# 6. TRAIN MODEL
# ==========================================

model.fit(X_train, y_train)


# ==========================================
# 7. TEST MODEL
# ==========================================

predictions = model.predict(X_test)

mae = mean_absolute_error(y_test, predictions)


print("\n" + "=" * 50)
print("CAMPUSFLOW - CROWD PREDICTION MODEL")
print("=" * 50)

print(f"\nTraining records: {len(X_train)}")
print(f"Testing records: {len(X_test)}")
print(f"Mean Absolute Error: {mae:.2f} people")


# ==========================================
# 8. PREDICT FUTURE CROWD
# ==========================================

location_id = 2
location_name = "Library"
capacity = 150
hour = 14
day_of_week = 0


sample = pd.DataFrame(
    [[location_id, capacity, hour, day_of_week]],
    columns=features
)


predicted_count = model.predict(sample)[0]

predicted_count = round(predicted_count)


# ==========================================
# 9. CALCULATE OCCUPANCY
# ==========================================

occupancy_percentage = (
    predicted_count / capacity
) * 100


# ==========================================
# 10. CLASSIFY CROWD
# ==========================================

if occupancy_percentage <= 40:
    crowd_level = "LOW"

elif occupancy_percentage <= 70:
    crowd_level = "MEDIUM"

else:
    crowd_level = "HIGH"


# ==========================================
# 11. DISPLAY RESULT
# ==========================================

print("\n" + "=" * 50)
print("FUTURE CROWD PREDICTION")
print("=" * 50)

print(f"\nLocation: {location_name}")
print(f"Capacity: {capacity}")
print(f"Predicted people: {predicted_count}")
print(f"Predicted occupancy: {occupancy_percentage:.1f}%")
print(f"Predicted crowd level: {crowd_level}")