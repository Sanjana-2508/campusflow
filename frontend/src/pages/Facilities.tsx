import { useMemo, useState } from "react";
import {
  BookOpen,
  Building2,
  Coffee,
  Dumbbell,
  MapPin,
  Search,
  Utensils,
  Users,
  X,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "../components/navbar";
import "../styles/facilities.css";

type FacilityCategory =
  | "All"
  | "Academic"
  | "Study"
  | "Food"
  | "Sports"
  | "Services";

type Facility = {
  id: number;
  name: string;
  category: Exclude<FacilityCategory, "All">;
  location: string;
  description: string;
  crowd: "Low" | "Moderate" | "High";
  status: "Open" | "Closed";
  icon: typeof Building2;
};

const facilities: Facility[] = [
  {
    id: 1,
    name: "Central Library",
    category: "Study",
    location: "North Campus",
    description:
      "Quiet study areas, reference sections and digital learning resources.",
    crowd: "Low",
    status: "Open",
    icon: BookOpen,
  },
  {
    id: 2,
    name: "Main Academic Block",
    category: "Academic",
    location: "Central Campus",
    description:
      "Lecture halls, classrooms, faculty offices and academic services.",
    crowd: "Moderate",
    status: "Open",
    icon: Building2,
  },
  {
    id: 3,
    name: "Campus Cafeteria",
    category: "Food",
    location: "Student Centre",
    description:
      "Main campus dining area with meals, snacks and refreshments.",
    crowd: "High",
    status: "Open",
    icon: Utensils,
  },
  {
    id: 4,
    name: "Innovation Lab",
    category: "Academic",
    location: "Technology Block",
    description:
      "Collaborative workspace for development, innovation and projects.",
    crowd: "Moderate",
    status: "Open",
    icon: Building2,
  },
  {
    id: 5,
    name: "Student Fitness Centre",
    category: "Sports",
    location: "South Campus",
    description:
      "Indoor fitness facilities and recreational activity spaces.",
    crowd: "Moderate",
    status: "Open",
    icon: Dumbbell,
  },
  {
    id: 6,
    name: "Coffee Corner",
    category: "Food",
    location: "Student Centre",
    description:
      "Quick coffee, beverages and light snacks between classes.",
    crowd: "Low",
    status: "Open",
    icon: Coffee,
  },
  {
    id: 7,
    name: "Student Services",
    category: "Services",
    location: "Administration Block",
    description:
      "Student support, documentation and campus administrative services.",
    crowd: "Low",
    status: "Open",
    icon: Users,
  },
  {
    id: 8,
    name: "Sports Complex",
    category: "Sports",
    location: "East Campus",
    description:
      "Outdoor and indoor spaces for sports, training and student activities.",
    crowd: "High",
    status: "Open",
    icon: Dumbbell,
  },
];

const categories: FacilityCategory[] = [
  "All",
  "Academic",
  "Study",
  "Food",
  "Sports",
  "Services",
];

export default function Facilities() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] =
    useState<FacilityCategory>("All");

  const filteredFacilities = useMemo(() => {
    return facilities.filter((facility) => {
      const matchesCategory =
        activeCategory === "All" ||
        facility.category === activeCategory;

      const query = search.toLowerCase();

      const matchesSearch =
        facility.name.toLowerCase().includes(query) ||
        facility.location.toLowerCase().includes(query) ||
        facility.category.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, search]);

  return (
    <div className="facilities-page">
      <Navbar />

      <main className="facilities-content">
        <header className="facilities-header">
          <div>
            <Link to="/dashboard" className="facilities-back">
              ← Back to overview
            </Link>

            <p className="eyebrow">CAMPUS DIRECTORY</p>

            <h1>Everything you need, nearby.</h1>

            <p>
              Discover classrooms, study spaces, food, sports and essential
              campus services in one place.
            </p>
          </div>

          <div className="facility-count">
            <strong>{facilities.length}</strong>
            <span>campus facilities</span>
          </div>
        </header>

        <section className="facility-toolbar">
          <div className="facility-search">
            <Search size={17} />

            <input
              type="text"
              placeholder="Search facilities..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="facility-filters">
            {categories.map((category) => (
              <button
                key={category}
                className={
                  activeCategory === category ? "active" : ""
                }
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </section>

        <section className="facility-results-header">
          <div>
            <p className="eyebrow">EXPLORE</p>
            <h2>Campus facilities</h2>
          </div>

          <span>
            {filteredFacilities.length} result
            {filteredFacilities.length !== 1 ? "s" : ""}
          </span>
        </section>

        {filteredFacilities.length > 0 ? (
          <section className="facility-grid">
            {filteredFacilities.map((facility) => {
              const Icon = facility.icon;

              return (
                <article className="facility-card" key={facility.id}>
                  <div className="facility-card-top">
                    <div className="facility-icon">
                      <Icon size={21} />
                    </div>

                    <span
                      className={`facility-status ${facility.status === "Open"
                        ? "open"
                        : "closed"
                        }`}
                    >
                      <i />
                      {facility.status}
                    </span>
                  </div>

                  <div className="facility-card-content">
                    <span className="facility-category">
                      {facility.category}
                    </span>

                    <h3>{facility.name}</h3>

                    <p>{facility.description}</p>
                  </div>

                  <div className="facility-meta">
                    <span>
                      <MapPin size={13} />
                      {facility.location}
                    </span>

                    <span
                      className={`facility-crowd ${facility.crowd.toLowerCase()}`}
                    >
                      <Users size={13} />
                      {facility.crowd}
                    </span>
                  </div>

                  <div className="facility-card-footer">
                    <Link to="/map">
                      View on map
                      <ChevronRight size={15} />
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <div className="facility-empty">
            <div>
              <Search size={22} />
            </div>

            <h3>No facilities found</h3>

            <p>
              Try another search term or choose a different category.
            </p>

            <button
              onClick={() => {
                setSearch("");
                setActiveCategory("All");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </main>
    </div>
  );
}