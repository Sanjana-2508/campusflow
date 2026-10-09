
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Car,
  ChevronRight,
  MapPin,
  Search,
  Users,
  X,
} from "lucide-react";
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "react-router-dom";
import Navbar from "../components/navbar";
import "../styles/campus-map.css";

type LocationType = "Building" | "Facility" | "Parking";

type CampusLocation = {
  id: number;
  name: string;
  type: LocationType;
  position: [number, number];
  crowd: "Low" | "Moderate" | "High";
  description: string;
};

const locations: CampusLocation[] = [
  {
    id: 1,
    name: "Main Academic Block",
    type: "Building",
    position: [12.9719, 77.5947],
    crowd: "Moderate",
    description: "Lecture halls, classrooms and academic offices.",
  },
  {
    id: 2,
    name: "Central Library",
    type: "Facility",
    position: [12.9725, 77.5954],
    crowd: "Low",
    description: "Quiet study spaces, reference books and digital resources.",
  },
  {
    id: 3,
    name: "Student Activity Centre",
    type: "Facility",
    position: [12.9713, 77.5958],
    crowd: "High",
    description: "Student clubs, activities and common spaces.",
  },
  {
    id: 4,
    name: "North Parking",
    type: "Parking",
    position: [12.9728, 77.5939],
    crowd: "Low",
    description: "Visitor and two-wheeler parking area.",
  },
  {
    id: 5,
    name: "Innovation Lab",
    type: "Building",
    position: [12.9709, 77.5942],
    crowd: "Moderate",
    description: "Innovation, development and project workspace.",
  },
];

const crowdColors = {
  Low: "#059669",
  Moderate: "#D97706",
  High: "#DC2626",
};

const createIcon = (type: LocationType) => {
  const symbols: Record<LocationType, string> = {
    Building: "⌂",
    Facility: "✦",
    Parking: "P",
  };

  return L.divIcon({
    className: "campus-marker-wrapper",
    html: `<div class="campus-marker">${symbols[type]}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -20],
  });
};

// Moves the map when a location is searched or selected.
function MapController({
  targetLocation,
}: {
  targetLocation: CampusLocation | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (targetLocation) {
      map.flyTo(targetLocation.position, 18, {
        animate: true,
        duration: 0.8,
      });
    }
  }, [map, targetLocation]);

  return null;
}

export default function CampusMap() {
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState<"All" | LocationType>("All");
  const [selectedLocation, setSelectedLocation] =
    useState<CampusLocation | null>(null);

  const filteredLocations = useMemo(() => {
    const query = search.trim().toLowerCase();

    return locations.filter((location) => {
      const matchesType =
        activeType === "All" || location.type === activeType;

      const matchesSearch =
        location.name.toLowerCase().includes(query);

      return matchesType && matchesSearch;
    });
  }, [activeType, search]);

  // Search takes priority; otherwise use the manually selected location.
  const targetLocation = search.trim()
    ? filteredLocations[0] ?? null
    : selectedLocation;

  return (
    <div className="campus-map-page">
      <Navbar />

      <main className="campus-map-content">
        <div className="map-header">
          <div>
            <Link to="/dashboard" className="back-link">
              ← Back to overview
            </Link>

            <p className="eyebrow">CAMPUS INTELLIGENCE</p>

            <h1>Explore your campus.</h1>

            <p className="map-intro">
              Find buildings, facilities, parking and real-time campus
              activity from one place.
            </p>
          </div>

          <div className="map-status">
            <span className="live-dot" />
            Campus live
          </div>
        </div>

        <section className="map-layout">
          <aside className="map-sidebar">
            <div className="search-box">
              <Search size={17} />

              <input
                type="text"
                placeholder="Search campus..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              {search && (
                <button
                  type="button"
                  className="clear-search"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <div className="map-filters">
              {(["All", "Building", "Facility", "Parking"] as const).map(
                (type) => (
                  <button
                    type="button"
                    key={type}
                    className={activeType === type ? "active" : ""}
                    onClick={() => setActiveType(type)}
                  >
                    {type}
                  </button>
                )
              )}
            </div>

            <div className="location-count">
              <span>Campus locations</span>
              <strong>{filteredLocations.length}</strong>
            </div>

            <div className="location-list">
              {filteredLocations.map((location) => (
                <button
                  type="button"
                  key={location.id}
                  className="location-item"
                  onClick={() => setSelectedLocation(location)}
                >
                  <div className="location-icon">
                    {location.type === "Parking" ? (
                      <Car size={17} />
                    ) : location.type === "Facility" ? (
                      <MapPin size={17} />
                    ) : (
                      <Building2 size={17} />
                    )}
                  </div>

                  <div className="location-info">
                    <strong>{location.name}</strong>
                    <span>{location.type}</span>
                  </div>

                  <ChevronRight size={16} />
                </button>
              ))}

              {filteredLocations.length === 0 && (
                <div className="empty-map-results">
                  <Search size={22} />
                  <strong>No locations found</strong>
                  <span>Try a different search.</span>
                </div>
              )}
            </div>
          </aside>

          <div className="map-panel">
            <MapContainer
              center={[12.9719, 77.5947]}
              zoom={17}
              scrollWheelZoom
              className="leaflet-campus-map"
            >
              <MapController targetLocation={targetLocation} />

              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <Circle
                center={[12.9719, 77.5947]}
                radius={130}
                pathOptions={{
                  color: "#2563EB",
                  fillColor: "#2563EB",
                  fillOpacity: 0.08,
                }}
              />

              {filteredLocations.map((location) => (
                <Marker
                  key={location.id}
                  position={location.position}
                  icon={createIcon(location.type)}
                  eventHandlers={{
                    click: () => setSelectedLocation(location),
                  }}
                >
                  <Popup>
                    <strong>{location.name}</strong>
                    <br />
                    {location.type} · {location.crowd} crowd
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            <div className="map-legend">
              <span>
                <i className="legend-dot low" />
                Low
              </span>

              <span>
                <i className="legend-dot moderate" />
                Moderate
              </span>

              <span>
                <i className="legend-dot high" />
                High
              </span>
            </div>
          </div>
        </section>

        {selectedLocation && (
          <section className="location-detail">
            <div className="detail-icon">
              <MapPin size={20} />
            </div>

            <div className="detail-content">
              <div className="detail-topline">
                <span>{selectedLocation.type}</span>

                <span
                  className="crowd-status"
                  style={{
                    color: crowdColors[selectedLocation.crowd],
                  }}
                >
                  <Users size={14} />
                  {selectedLocation.crowd} crowd
                </span>
              </div>

              <h2>{selectedLocation.name}</h2>
              <p>{selectedLocation.description}</p>
            </div>

            <button
              type="button"
              className="close-detail"
              onClick={() => setSelectedLocation(null)}
              aria-label="Close location details"
            >
              <X size={18} />
            </button>
          </section>
        )}
      </main>
    </div>
  );
}