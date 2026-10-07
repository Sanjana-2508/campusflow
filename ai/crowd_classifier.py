def classify_crowd(people_count, capacity):

    # Calculate occupancy percentage
    percentage = (people_count / capacity) * 100

    # Decide crowd level
    if percentage <= 40:
        crowd_level = "LOW"

    elif percentage <= 70:
        crowd_level = "MEDIUM"

    else:
        crowd_level = "HIGH"

    return percentage, crowd_level


# Test
if __name__ == "__main__":

    people = 60
    capacity = 100

    percentage, level = classify_crowd(people, capacity)

    print("People:", people)
    print("Capacity:", capacity)
    print("Occupancy:", round(percentage, 2), "%")
    print("Crowd Level:", level)