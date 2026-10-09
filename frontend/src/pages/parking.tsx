import { useMemo, useState } from "react";
import {
  ArrowRight,
  Car,
  CheckCircle2,
  Clock3,
  MapPin,
  Navigation,
  ParkingSquare,
} from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "../components/navbar";
import "../styles/parking.css";

type SpotStatus = "available" | "occupied";

type ParkingSpot = {
  id: string;
  status: SpotStatus;
};

type ParkingZone = {
  id: string;
  name: string;
  location: string;
  total: number;
  available: number;
  spots: ParkingSpot[];
};

const createSpots = (
  total: number,
  occupiedCount: number
): ParkingSpot[] => {
  return Array.from({ length: total }, (_, index) => ({
    id: `${index + 1}`,
    status: index < occupiedCount ? "occupied" : "available",
  }));
};

const parkingZones: ParkingZone[] = [
  {
    id: "north",
    name: "North Parking",
    location: "Near Main Gate",
    total: 24,
    available: 9,
    spots: createSpots(24, 15),
  },
  {
    id: "academic",
    name: "Academic Block",
    location: "Behind Academic Block",
    total: 32,
    available: 14,
    spots: createSpots(32, 18),
  },
  {
    id: "student",
    name: "Student Parking",
    location: "Near Activity Centre",
    total: 40,
    available: 19,
    spots: createSpots(40, 21),
  },
];

export default function Parking() {
  const [selectedZone, setSelectedZone] = useState(parkingZones[0]);
  const [selectedSpot, setSelectedSpot] = useState<string | null>(null);

  const occupied = selectedZone.total - selectedZone.available;

  const utilization = useMemo(() => {
    return Math.round((occupied / selectedZone.total) * 100);
  }, [occupied, selectedZone.total]);

  const findNearestSpot = () => {
    const availableSpot = selectedZone.spots.find(
      (spot) => spot.status === "available"
    );

    if (availableSpot) {
      setSelectedSpot(availableSpot.id);
    }
  };

  return (
    <div className="parking-page">
      <Navbar />

      <main className="parking-content">
        <header className="parking-header">
          <div>
            <Link to="/dashboard" className="parking-back">
              ← Back to overview
            </Link>

            <p className="eyebrow">SMART MOBILITY</p>

            <h1>Park without the guesswork.</h1>

            <p>
              Check availability, explore parking zones and find an open spot
              before you arrive.
            </p>
          </div>

          <div className="parking-live">
            <span className="live-dot" />
            Live availability
          </div>
        </header>

        <section className="parking-overview">
          <div className="parking-stat primary">
            <div className="stat-icon">
              <ParkingSquare size={20} />
            </div>

            <span>Available now</span>

            <strong>42</strong>

            <small>Across all parking zones</small>
          </div>

          <div className="parking-stat">
            <span>Total spaces</span>
            <strong>96</strong>
            <small>Registered campus spots</small>
          </div>

          <div className="parking-stat">
            <span>Occupied</span>
            <strong>54</strong>
            <small>Current occupancy</small>
          </div>

          <div className="parking-stat">
            <span>Utilization</span>
            <strong>56%</strong>
            <small>Campus-wide</small>
          </div>
        </section>

        <section className="parking-main">
          <div className="zones-panel">
            <div className="section-title">
              <div>
                <p className="eyebrow">PARKING ZONES</p>
                <h2>Choose a zone</h2>
              </div>

              <button
                className="find-button"
                onClick={findNearestSpot}
              >
                <Navigation size={15} />
                Find nearest
              </button>
            </div>

            <div className="zone-list">
              {parkingZones.map((zone) => {
                const zoneUtilization = Math.round(
                  ((zone.total - zone.available) / zone.total) * 100
                );

                return (
                  <button
                    key={zone.id}
                    className={
                      selectedZone.id === zone.id
                        ? "zone-card active"
                        : "zone-card"
                    }
                    onClick={() => {
                      setSelectedZone(zone);
                      setSelectedSpot(null);
                    }}
                  >
                    <div className="zone-icon">
                      <Car size={19} />
                    </div>

                    <div className="zone-info">
                      <strong>{zone.name}</strong>

                      <span>
                        <MapPin size={12} />
                        {zone.location}
                      </span>
                    </div>

                    <div className="zone-availability">
                      <strong>{zone.available}</strong>
                      <span>available</span>
                    </div>

                    <div className="zone-bar">
                      <span
                        style={{
                          width: `${zoneUtilization}%`,
                        }}
                      />
                    </div>

                    <ArrowRight size={17} className="zone-arrow" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="parking-grid-panel">
            <div className="parking-grid-header">
              <div>
                <p className="eyebrow">LIVE ZONE</p>
                <h2>{selectedZone.name}</h2>
              </div>

              <div className="updated-time">
                <Clock3 size={14} />
                Updated just now
              </div>
            </div>

            <div className="parking-progress">
              <div>
                <span>Occupancy</span>
                <strong>{utilization}%</strong>
              </div>

              <div className="progress-track">
                <span style={{ width: `${utilization}%` }} />
              </div>
            </div>

            <div className="spot-legend">
              <span>
                <i className="available-dot" />
                Available
              </span>

              <span>
                <i className="occupied-dot" />
                Occupied
              </span>
            </div>

            <div className="parking-spots">
              {selectedZone.spots.map((spot) => {
                const isSelected = selectedSpot === spot.id;
                const isAvailable = spot.status === "available";

                return (
                  <button
                    key={spot.id}
                    disabled={!isAvailable}
                    onClick={() =>
                      isAvailable && setSelectedSpot(spot.id)
                    }
                    className={[
                      "parking-spot",
                      isAvailable ? "available" : "occupied",
                      isSelected ? "selected" : "",
                    ].join(" ")}
                    title={
                      isAvailable
                        ? `Parking spot ${spot.id}`
                        : "Occupied"
                    }
                  >
                    <Car size={16} />
                    <span>{spot.id}</span>
                  </button>
                );
              })}
            </div>

            {selectedSpot && (
              <div className="selected-spot">
                <div>
                  <CheckCircle2 size={20} />

                  <div>
                    <strong>Spot {selectedSpot} is available</strong>
                    <span>
                      {selectedZone.name} · Ready to park
                    </span>
                  </div>
                </div>

                <button onClick={() => setSelectedSpot(null)}>
                  Clear
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="parking-tip">
          <div className="tip-icon">
            <Navigation size={19} />
          </div>

          <div>
            <p className="eyebrow">SMART RECOMMENDATION</p>

            <h3>
              Student Parking currently has the most availability.
            </h3>

            <p>
              19 spots are open, making it the best option if you're arriving
              now.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}