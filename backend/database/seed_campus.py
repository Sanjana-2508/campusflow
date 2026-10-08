from decimal import Decimal

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.building import Building
from app.models.campus_node import CampusNode
from app.models.campus_path import CampusPath
from app.models.facility import Facility
from app.models.gate import Gate


# Demo campus dataset for demonstration use only.
# Coordinates are illustrative Bengaluru-style values and not tied to a real campus.
DEMO_BUILDINGS = [
    {
        "name": "Demo Admin Block",
        "type": "Administrative",
        "lat": 12.9715,
        "lng": 77.5944,
        "description": "Demo administrative block for campus walkthroughs.",
    },
    {
        "name": "Demo Academic Block",
        "type": "Academic",
        "lat": 12.9721,
        "lng": 77.5951,
        "description": "Demo academic block hosting classrooms and faculty offices.",
    },
    {
        "name": "Demo Library",
        "type": "Library",
        "lat": 12.9726,
        "lng": 77.5949,
        "description": "Demo central library used for student learning resources.",
    },
    {
        "name": "Demo Research Center",
        "type": "Research",
        "lat": 12.9728,
        "lng": 77.5964,
        "description": "Demo research and innovation facility.",
    },
    {
        "name": "Demo Hostel Block",
        "type": "Residential",
        "lat": 12.9712,
        "lng": 77.5962,
        "description": "Demo student accommodation block.",
    },
    {
        "name": "Demo Innovation Hub",
        "type": "Innovation",
        "lat": 12.9723,
        "lng": 77.5968,
        "description": "Demo startup and student innovation hub.",
    },
]

DEMO_FACILITIES = [
    {
        "building_name": "Demo Admin Block",
        "name": "Demo Reception Desk",
        "category": "Administration",
        "lat": 12.9716,
        "lng": 77.5945,
        "description": "Demo front desk for visitor services.",
    },
    {
        "building_name": "Demo Academic Block",
        "name": "Demo Lecture Hall A",
        "category": "Classroom",
        "lat": 12.9722,
        "lng": 77.5953,
        "description": "Demo lecture hall for large classes.",
    },
    {
        "building_name": "Demo Academic Block",
        "name": "Demo Seminar Room",
        "category": "Meeting",
        "lat": 12.9720,
        "lng": 77.5955,
        "description": "Demo seminar room for group sessions.",
    },
    {
        "building_name": "Demo Library",
        "name": "Demo Reading Lounge",
        "category": "Study",
        "lat": 12.9727,
        "lng": 77.5950,
        "description": "Demo student reading and study area.",
    },
    {
        "building_name": "Demo Library",
        "name": "Demo Digital Lab",
        "category": "Lab",
        "lat": 12.9728,
        "lng": 77.5952,
        "description": "Demo digital learning lab.",
    },
    {
        "building_name": "Demo Research Center",
        "name": "Demo Innovation Lab",
        "category": "Lab",
        "lat": 12.9729,
        "lng": 77.5962,
        "description": "Demo prototype and testing workspace.",
    },
    {
        "building_name": "Demo Hostel Block",
        "name": "Demo Cafeteria",
        "category": "Dining",
        "lat": 12.9710,
        "lng": 77.5961,
        "description": "Demo campus cafeteria for resident students.",
    },
    {
        "building_name": "Demo Hostel Block",
        "name": "Demo Gymnasium",
        "category": "Wellness",
        "lat": 12.9714,
        "lng": 77.5966,
        "description": "Demo fitness and wellness area.",
    },
    {
        "building_name": "Demo Innovation Hub",
        "name": "Demo Startup Lab",
        "category": "Startup",
        "lat": 12.9724,
        "lng": 77.5969,
        "description": "Demo startup incubation workspace.",
    },
    {
        "building_name": "Demo Innovation Hub",
        "name": "Demo Maker Space",
        "category": "Workshop",
        "lat": 12.9721,
        "lng": 77.5971,
        "description": "Demo fabrication and prototyping facility.",
    },
]

DEMO_GATES = [
    {
        "name": "Demo North Gate",
        "lat": 12.9708,
        "lng": 77.5940,
        "description": "Demo north entry gate for campus access.",
    },
    {
        "name": "Demo East Gate",
        "lat": 12.9732,
        "lng": 77.5976,
        "description": "Demo east entry gate for campus access.",
    },
    {
        "name": "Demo West Gate",
        "lat": 12.9706,
        "lng": 77.5969,
        "description": "Demo west entry gate for campus access.",
    },
]

DEMO_PATHS = [
    {"name": "Demo North Gate -> Demo Admin Block", "from_node": "Demo North Gate", "to_node": "Demo Admin Block", "length_m": 220.0},
    {"name": "Demo Admin Block -> Demo Academic Block", "from_node": "Demo Admin Block", "to_node": "Demo Academic Block", "length_m": 180.0},
    {"name": "Demo Academic Block -> Demo Library", "from_node": "Demo Academic Block", "to_node": "Demo Library", "length_m": 220.0},
    {"name": "Demo Library -> Demo Research Center", "from_node": "Demo Library", "to_node": "Demo Research Center", "length_m": 260.0},
    {"name": "Demo Research Center -> Demo East Gate", "from_node": "Demo Research Center", "to_node": "Demo East Gate", "length_m": 310.0},
    {"name": "Demo Academic Block -> Demo Innovation Hub", "from_node": "Demo Academic Block", "to_node": "Demo Innovation Hub", "length_m": 240.0},
    {"name": "Demo Innovation Hub -> Demo Hostel Block", "from_node": "Demo Innovation Hub", "to_node": "Demo Hostel Block", "length_m": 290.0},
    {"name": "Demo Hostel Block -> Demo West Gate", "from_node": "Demo Hostel Block", "to_node": "Demo West Gate", "length_m": 330.0},
    {"name": "Demo Library -> Demo Central Plaza", "from_node": "Demo Library", "to_node": "Demo Central Plaza", "length_m": 120.0},
    {"name": "Demo Central Plaza -> Demo Academic Block", "from_node": "Demo Central Plaza", "to_node": "Demo Academic Block", "length_m": 150.0},
]


def to_decimal(value: float) -> Decimal:
    return Decimal(str(value))


def ensure_building(db: Session, data: dict) -> tuple[Building, bool]:
    existing = db.query(Building).filter(Building.name == data["name"]).first()
    if existing:
        return existing, False

    building = Building(
        name=data["name"],
        type=data["type"],
        lat=to_decimal(data["lat"]),
        lng=to_decimal(data["lng"]),
        description=data["description"],
    )
    db.add(building)
    db.flush()
    return building, True


def ensure_facility(db: Session, data: dict, building_lookup: dict[str, int]) -> tuple[Facility, bool]:
    existing = db.query(Facility).filter(Facility.name == data["name"]).first()
    if existing:
        return existing, False

    facility = Facility(
        building_id=building_lookup[data["building_name"]],
        name=data["name"],
        category=data["category"],
        lat=to_decimal(data["lat"]),
        lng=to_decimal(data["lng"]),
        description=data["description"],
    )
    db.add(facility)
    db.flush()
    return facility, True


def ensure_gate(db: Session, data: dict) -> tuple[Gate, bool]:
    existing = db.query(Gate).filter(Gate.name == data["name"]).first()
    if existing:
        return existing, False

    gate = Gate(
        name=data["name"],
        lat=to_decimal(data["lat"]),
        lng=to_decimal(data["lng"]),
        description=data["description"],
    )
    db.add(gate)
    db.flush()
    return gate, True


def ensure_campus_node_for_building(db: Session, building: Building) -> tuple[CampusNode, bool]:
    existing = (
        db.query(CampusNode)
        .filter(CampusNode.label == building.name)
        .filter(CampusNode.node_type == "BUILDING")
        .filter(CampusNode.ref_id == building.id)
        .first()
    )
    if existing:
        return existing, False

    node = CampusNode(
        label=building.name,
        node_type="BUILDING",
        ref_id=building.id,
        lat=building.lat,
        lng=building.lng,
    )
    db.add(node)
    db.flush()
    return node, True


def ensure_campus_node_for_gate(db: Session, gate: Gate) -> tuple[CampusNode, bool]:
    existing = (
        db.query(CampusNode)
        .filter(CampusNode.label == gate.name)
        .filter(CampusNode.node_type == "GATE")
        .filter(CampusNode.ref_id == gate.id)
        .first()
    )
    if existing:
        return existing, False

    node = CampusNode(
        label=gate.name,
        node_type="GATE",
        ref_id=gate.id,
        lat=gate.lat,
        lng=gate.lng,
    )
    db.add(node)
    db.flush()
    return node, True


def ensure_landmark_node(db: Session, label: str, lat: float, lng: float) -> tuple[CampusNode, bool]:
    existing = db.query(CampusNode).filter(CampusNode.label == label).filter(CampusNode.node_type == "LANDMARK").first()
    if existing:
        return existing, False

    node = CampusNode(
        label=label,
        node_type="LANDMARK",
        ref_id=None,
        lat=to_decimal(lat),
        lng=to_decimal(lng),
    )
    db.add(node)
    db.flush()
    return node, True


def ensure_campus_path(db: Session, name: str, from_node_id: int, to_node_id: int, length_m: float, bidirectional: bool = True) -> tuple[CampusPath, bool]:
    existing = db.query(CampusPath).filter(CampusPath.name == name).first()
    if existing:
        return existing, False

    path = CampusPath(
        name=name,
        from_node_id=from_node_id,
        to_node_id=to_node_id,
        length_m=to_decimal(length_m),
        bidirectional=bidirectional,
        crowd_location_id=None,
    )
    db.add(path)
    db.flush()
    return path, True


def seed_demo_campus() -> None:
    db: Session = SessionLocal()
    inserted_buildings = 0
    inserted_facilities = 0
    inserted_gates = 0
    inserted_nodes = 0
    inserted_paths = 0

    try:
        building_lookup: dict[str, int] = {}

        for building_data in DEMO_BUILDINGS:
            building, is_new = ensure_building(db, building_data)
            if is_new:
                inserted_buildings += 1
            building_lookup[building_data["name"]] = building.id

        for facility_data in DEMO_FACILITIES:
            _, is_new = ensure_facility(db, facility_data, building_lookup)
            if is_new:
                inserted_facilities += 1

        for gate_data in DEMO_GATES:
            _, is_new = ensure_gate(db, gate_data)
            if is_new:
                inserted_gates += 1

        building_nodes: dict[str, CampusNode] = {}
        for building_data in DEMO_BUILDINGS:
            building = db.query(Building).filter(Building.name == building_data["name"]).first()
            if building is None:
                continue
            node, is_new = ensure_campus_node_for_building(db, building)
            if is_new:
                inserted_nodes += 1
            building_nodes[building_data["name"]] = node

        gate_nodes: dict[str, CampusNode] = {}
        for gate_data in DEMO_GATES:
            gate = db.query(Gate).filter(Gate.name == gate_data["name"]).first()
            if gate is None:
                continue
            node, is_new = ensure_campus_node_for_gate(db, gate)
            if is_new:
                inserted_nodes += 1
            gate_nodes[gate_data["name"]] = node

        plaza_node, is_new = ensure_landmark_node(db, "Demo Central Plaza", 12.9721, 77.5958)
        if is_new:
            inserted_nodes += 1

        node_lookup = {**building_nodes, **gate_nodes, "Demo Central Plaza": plaza_node}

        for path_data in DEMO_PATHS:
            from_node = node_lookup[path_data["from_node"]]
            to_node = node_lookup[path_data["to_node"]]
            _, is_new = ensure_campus_path(
                db,
                path_data["name"],
                from_node.id,
                to_node.id,
                path_data["length_m"],
                bidirectional=True,
            )
            if is_new:
                inserted_paths += 1

        db.commit()

        print("Campus seed completed")
        print(f"Buildings inserted: {inserted_buildings}")
        print(f"Facilities inserted: {inserted_facilities}")
        print(f"Gates inserted: {inserted_gates}")
        print(f"Campus nodes inserted: {inserted_nodes}")
        print(f"Campus paths inserted: {inserted_paths}")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    try:
        seed_demo_campus()
    except Exception as exc:
        print(f"Campus seed failed: {exc}")
        raise SystemExit(1)
