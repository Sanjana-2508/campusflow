import random
from datetime import datetime


def generate_crowd(capacity, previous_count=None):

    current_hour = datetime.now().hour

    # Expected crowd based on time
    if 8 <= current_hour < 10:
        base_percentage = 0.30
    elif 10 <= current_hour < 12:
        base_percentage = 0.50
    elif 12 <= current_hour < 14:
        base_percentage = 0.75
    elif 14 <= current_hour < 16:
        base_percentage = 0.85
    elif 16 <= current_hour < 18:
        base_percentage = 0.55
    else:
        base_percentage = 0.25

    # Target crowd for this time
    target_count = int(capacity * base_percentage)

    # First reading
    if previous_count is None:
        variation = random.randint(
            -int(capacity * 0.05),
            int(capacity * 0.05)
        )

        return max(
            0,
            min(capacity, target_count + variation)
        )

    # Gradual change from previous reading
    max_change = max(2, int(capacity * 0.05))

    change = random.randint(-max_change, max_change)

    new_count = previous_count + change

    # Slowly move toward the expected crowd
    if new_count < target_count:
        new_count += 1
    elif new_count > target_count:
        new_count -= 1

    # Keep within capacity
    new_count = max(0, min(capacity, new_count))

    return new_count