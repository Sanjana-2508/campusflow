from recommend import spaces_available, worst_crowd

# Examples from Section 6.2 of the spec
# spaces_available(capacity, staff_reserved, student_held, staff_held, role)

# Parking A: student sees 4, staff sees 8
assert spaces_available(40, 8, 28, 4, "STUDENT") == 4
assert spaces_available(40, 8, 28, 4, "FACULTY_STAFF") == 8

# Parking B: student sees 18, staff sees 22
assert spaces_available(40, 6, 16, 2, "STUDENT") == 18
assert spaces_available(40, 6, 16, 2, "FACULTY_STAFF") == 22

# Staff overflow: staff use up the general pool, so students lose spaces
assert spaces_available(40, 8, 0, 20, "STUDENT") == 20

# Never a negative number
assert spaces_available(10, 4, 8, 0, "STUDENT") == 0

# Zone with nothing booked: students can't use the staff-reserved spaces
assert spaces_available(40, 8, 0, 0, "STUDENT") == 32
assert spaces_available(40, 8, 0, 0, "FACULTY_STAFF") == 40

# Crowd: the worst level on the route counts
assert worst_crowd(["a", "b"], {"a": "LOW", "b": "HIGH"}) == "HIGH"
assert worst_crowd(["a", "b"], {"a": "LOW", "b": "MEDIUM"}) == "MEDIUM"
assert worst_crowd(["a"], {}) == "LOW"  # no data means LOW

print("All tests passed")