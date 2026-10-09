# Crowd levels by campus node id, for example {"B1": "HIGH"}.
# TEMPORARY: demo values live here in memory.
# Person 3 / Person 2 can later fill this from the real crowd data.
_crowd = {}

VALID_LEVELS = ("LOW", "MEDIUM", "HIGH")


def get_crowd():
    return dict(_crowd)


def set_crowd(node_id, level):
    if level == "LOW":
        _crowd.pop(node_id, None)   # LOW needs no penalty
    else:
        _crowd[node_id] = level