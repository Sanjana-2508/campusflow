import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  MapPin,
  Search,
  Users,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "../components/navbar";
import "../styles/events.css";

type EventCategory =
  | "All"
  | "Technology"
  | "Cultural"
  | "Workshop"
  | "Sports"
  | "Community";

type CampusEvent = {
  id: number;
  title: string;
  category: Exclude<EventCategory, "All">;
  date: string;
  day: string;
  month: string;
  time: string;
  venue: string;
  description: string;
  attendees: number;
  featured?: boolean;
};

const events: CampusEvent[] = [
  {
    id: 1,
    title: "Future of AI & Innovation",
    category: "Technology",
    date: "18 Oct 2026",
    day: "18",
    month: "OCT",
    time: "10:00 AM – 12:30 PM",
    venue: "Innovation Auditorium",
    description:
      "Explore emerging AI trends, practical applications and the future of intelligent technology.",
    attendees: 184,
    featured: true,
  },
  {
    id: 2,
    title: "Frontend Development Workshop",
    category: "Workshop",
    date: "20 Oct 2026",
    day: "20",
    month: "OCT",
    time: "2:00 PM – 4:00 PM",
    venue: "Innovation Lab",
    description:
      "A hands-on session covering modern frontend development and interface design.",
    attendees: 72,
  },
  {
    id: 3,
    title: "Campus Cultural Night",
    category: "Cultural",
    date: "22 Oct 2026",
    day: "22",
    month: "OCT",
    time: "6:00 PM – 9:00 PM",
    venue: "Open Air Theatre",
    description:
      "An evening of music, dance, performances and student creativity.",
    attendees: 320,
  },
  {
    id: 4,
    title: "Inter-Department Football",
    category: "Sports",
    date: "24 Oct 2026",
    day: "24",
    month: "OCT",
    time: "4:00 PM – 6:00 PM",
    venue: "Campus Sports Ground",
    description:
      "Watch departments compete in the next round of the campus football tournament.",
    attendees: 146,
  },
  {
    id: 5,
    title: "Student Startup Meetup",
    category: "Community",
    date: "26 Oct 2026",
    day: "26",
    month: "OCT",
    time: "3:00 PM – 5:00 PM",
    venue: "Seminar Hall 2",
    description:
      "Meet student founders, exchange ideas and discover opportunities to collaborate.",
    attendees: 95,
  },
  {
    id: 6,
    title: "Design Thinking Masterclass",
    category: "Workshop",
    date: "28 Oct 2026",
    day: "28",
    month: "OCT",
    time: "11:00 AM – 1:00 PM",
    venue: "Design Studio",
    description:
      "Learn how to turn real-world problems into meaningful product ideas.",
    attendees: 61,
  },
];

const categories: EventCategory[] = [
  "All",
  "Technology",
  "Cultural",
  "Workshop",
  "Sports",
  "Community",
];

export default function Events() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] =
    useState<EventCategory>("All");

  const filteredEvents = useMemo(() => {
    const query = search.toLowerCase();

    return events.filter((event) => {
      const matchesCategory =
        activeCategory === "All" ||
        event.category === activeCategory;

      const matchesSearch =
        event.title.toLowerCase().includes(query) ||
        event.venue.toLowerCase().includes(query) ||
        event.category.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, search]);

  const featuredEvent = events.find((event) => event.featured);

  return (
    <div className="events-page">
      <Navbar />

      <main className="events-content">
        <header className="events-header">
          <div>
            <Link to="/dashboard" className="events-back">
              ← Back to overview
            </Link>

            <p className="eyebrow">CAMPUS CALENDAR</p>

            <h1>Don't miss what's happening.</h1>

            <p>
              Discover talks, workshops, cultural events, competitions and
              experiences happening across campus.
            </p>
          </div>

          <div className="events-count">
            <strong>{events.length}</strong>
            <span>upcoming events</span>
          </div>
        </header>

        {featuredEvent && (
          <section className="featured-event">
            <div className="featured-date">
              <span>{featuredEvent.month}</span>
              <strong>{featuredEvent.day}</strong>
            </div>

            <div className="featured-content">
              <span className="featured-label">FEATURED EVENT</span>

              <h2>{featuredEvent.title}</h2>

              <p>{featuredEvent.description}</p>

              <div className="featured-meta">
                <span>
                  <Clock3 size={14} />
                  {featuredEvent.time}
                </span>

                <span>
                  <MapPin size={14} />
                  {featuredEvent.venue}
                </span>

                <span>
                  <Users size={14} />
                  {featuredEvent.attendees} attending
                </span>
              </div>
            </div>

            <button className="featured-button">
              View event
              <ArrowRight size={16} />
            </button>
          </section>
        )}

        <section className="events-toolbar">
          <div className="event-search">
            <Search size={17} />

            <input
              type="text"
              placeholder="Search events..."
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

          <div className="event-filters">
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

        <section className="events-results-header">
          <div>
            <p className="eyebrow">UPCOMING</p>
            <h2>Campus events</h2>
          </div>

          <span>
            {filteredEvents.length} event
            {filteredEvents.length !== 1 ? "s" : ""}
          </span>
        </section>

        {filteredEvents.length > 0 ? (
          <section className="events-grid">
            {filteredEvents.map((event) => (
              <article className="event-card" key={event.id}>
                <div className="event-card-top">
                  <div className="event-date">
                    <span>{event.month}</span>
                    <strong>{event.day}</strong>
                  </div>

                  <span className="event-category">
                    {event.category}
                  </span>
                </div>

                <div className="event-card-content">
                  <h3>{event.title}</h3>

                  <p>{event.description}</p>
                </div>

                <div className="event-details">
                  <span>
                    <Clock3 size={13} />
                    {event.time}
                  </span>

                  <span>
                    <MapPin size={13} />
                    {event.venue}
                  </span>

                  <span>
                    <Users size={13} />
                    {event.attendees} attending
                  </span>
                </div>

                <div className="event-card-footer">
                  <button>
                    View details
                    <ArrowRight size={14} />
                  </button>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <div className="events-empty">
            <div>
              <CalendarDays size={22} />
            </div>

            <h3>No events found</h3>

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