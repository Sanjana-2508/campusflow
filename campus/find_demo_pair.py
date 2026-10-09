from routing import find_route, load_graph

nodes, _ = load_graph()
ids = list(nodes)

for start in ids:
    for end in ids:
        if start >= end:
            continue
        normal = find_route(start, end)
        if not normal or len(normal["node_ids"]) < 3:
            continue
        # try making each stop in the middle crowded, one at a time
        for mid in normal["node_ids"][1:-1]:
            smart = find_route(start, end, crowd={mid: "HIGH"})
            if smart["node_ids"] != normal["node_ids"]:
                print(f"{start} -> {end}: crowd at {mid} ({nodes[mid]['label']})")
                print("   normal:", " -> ".join(normal["labels"]), f"| {normal['distance_m']} m")
                print("   smart :", " -> ".join(smart["labels"]), f"| {smart['distance_m']} m")