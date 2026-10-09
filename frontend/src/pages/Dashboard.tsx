
import { useEffect, useState } from "react";
import Navbar from "../components/navbar";
import {
  Map,
  Car,
  Building2,
  CalendarDays,
  PackageSearch,
  Bell,
  Users,
  Library,
  Utensils,
  GraduationCap,
  Activity,
  Sparkles,
  ArrowUpRight,
  Clock3,
  Zap,
  BookOpenCheck,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import "../styles/dashboard.css";

const features = [
  {
    title: "Campus Map",
    description: "Find buildings, facilities and routes around campus.",
    icon: Map,
    path: "/map",
    theme: "map-theme",
    label: "EXPLORE",
  },
  {
    title: "Smart Parking",
    description: "Check parking availability and find a nearby spot.",
    icon: Car,
    path: "/parking",
    theme: "parking-theme",
    label: "PARK",
  },
  {
    title: "Facilities",
    description: "Discover labs, classrooms, cafeterias and services.",
    icon: Building2,
    path: "/facilities",
    theme: "facilities-theme",
    label: "DISCOVER",
  },
  {
    title: "Events",
    description: "Stay updated with upcoming campus events.",
    icon: CalendarDays,
    path: "/events",
    theme: "events-theme",
    label: "WHAT'S ON",
  },
  {
    title: "Lost & Found",
    description: "Report or find items lost around campus.",
    icon: PackageSearch,
    path: "/lost-found",
    theme: "lost-theme",
    label: "RECONNECT",
  },
  {
    title: "Notifications",
    description: "View important campus updates and announcements.",
    icon: Bell,
    path: "/notifications",
    theme: "notifications-theme",
    label: "UPDATES",
  },
  {
    title: "Faculty Directory",
    description: "Find faculty, check cabin status and request a meeting.",
    icon: BookOpenCheck,
    path: "/faculty-directory",
    theme: "facilities-theme",
    label: "PEOPLE",
  },
];

const crowdLocations = [
  {
    name: "Central Library",
    type: "Study Area",
    crowd: "Low",
    percentage: 28,
    icon: Library,
  },
  {
    name: "Main Academic Block",
    type: "Academic",
    crowd: "Moderate",
    percentage: 64,
    icon: GraduationCap,
  },
  {
    name: "Campus Cafeteria",
    type: "Dining",
    crowd: "High",
    percentage: 86,
    icon: Utensils,
  },
  {
    name: "Student Activity Centre",
    type: "Student Life",
    crowd: "Moderate",
    percentage: 58,
    icon: Activity,
  },
];

const crowdClass = (crowd: string) => {
  if (crowd === "Low") return "crowd-low";
  if (crowd === "High") return "crowd-high";
  return "crowd-moderate";
};

function getGreeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const location = useLocation();
  const registrationNotice = (location.state as { registrationNotice?: string } | null)?.registrationNotice;
  const loginNotice = (location.state as { loginNotice?: string } | null)?.loginNotice;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const greeting = getGreeting(now.getHours());

  const formattedDate = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

  const formattedTime = new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(now);

  return (
    <div className="dashboard">
      <Navbar />

      <main className="dashboard-content">
        {registrationNotice && (
          <div className="dashboard-registration-notice" role="status">
            <Sparkles size={17} />
            <span>{registrationNotice}</span>
          </div>
        )}
        {loginNotice && (
          <div className="dashboard-registration-notice" role="status">
            <Sparkles size={17} />
            <span>{loginNotice}</span>
          </div>
        )}

        {/* HERO */}

        <section className="hero dashboard-hero">
          <div className="hero-copy">
            <p className="eyebrow dashboard-eyebrow">
              <span className="hero-eyebrow-dot" />
              CAMPUS PULSE / YOUR SPACE
            </p>

            <p className="dashboard-greeting">
              {greeting}, explorer <span>✳</span>
            </p>

            <h1>
              Your campus,
              <br />
              <span className="hero-highlight">connected.</span>
            </h1>

            <p className="hero-description">
              Navigate smarter, discover what’s happening and
              make the most of every moment on campus.
            </p>

            <div className="hero-actions">
              <Link to="/map" className="hero-primary-action">
                Explore campus <ArrowUpRight size={17} />
              </Link>

              <Link to="/events" className="hero-secondary-action">
                Discover events
              </Link>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-visual-orbit orbit-a" />
            <div className="hero-visual-orbit orbit-b" />
            <div className="hero-visual-orbit orbit-c" />

            <div className="hero-visual-center">
              <div className="hero-center-icon">
                <GraduationCap size={37} />
              </div>
              <span>CAMPUS</span>
              <strong>IN MOTION</strong>
            </div>

            <div className="hero-float-card float-card-one">
              <Map size={17} />
              <span>Find your way</span>
            </div>

            <div className="hero-float-card float-card-two">
              <Sparkles size={17} />
              <span>Discover more</span>
            </div>

            <div className="hero-visual-star star-a">✳</div>
            <div className="hero-visual-star star-b">✦</div>
          </div>

          <div className="status-card dashboard-status">
            <div className="status-card-heading">
              <span className="status-card-label">YOUR LOCAL TIME</span>
              <Clock3 size={17} />
            </div>

            <strong className="dashboard-clock">{formattedTime}</strong>
            <small>{formattedDate}</small>

            <div className="status-divider" />

            <span className="status-operational">
              <span className="status-live-dot" />
              CampusFlow is ready to explore
            </span>
          </div>
        </section>

        {/* QUICK STATS */}

        <section className="stats dashboard-stats" aria-label="Campus shortcuts">
          <Link to="/map" className="stat-card stat-lavender">
            <span className="stat-topline">
              CAMPUS CROWD <Users size={17} />
            </span>
            <strong>Moderate</strong>
            <span className="stat-bottomline">
              Sample activity level <ArrowUpRight size={14} />
            </span>
            <span className="stat-decoration stat-decoration-circle" />
          </Link>

          <Link to="/parking" className="stat-card stat-blue">
            <span className="stat-topline">
              PARKING <Car size={17} />
            </span>
            <strong>42 spots</strong>
            <span className="stat-bottomline">
              Sample availability <ArrowUpRight size={14} />
            </span>
            <span className="stat-decoration stat-decoration-bars">
              <i /><i /><i /><i /><i />
            </span>
          </Link>

          <Link to="/events" className="stat-card stat-peach">
            <span className="stat-topline">
              TODAY'S EVENTS <CalendarDays size={17} />
            </span>
            <strong>08 events</strong>
            <span className="stat-bottomline">
              Sample event count <ArrowUpRight size={14} />
            </span>
            <span className="stat-decoration stat-decoration-star">✳</span>
          </Link>
        </section>

        {/* CROWD INTELLIGENCE */}

        <section className="crowd-section">
          <div className="crowd-heading">
            <div>
              <p className="eyebrow dashboard-eyebrow">
                CROWD INTELLIGENCE / 01
              </p>
              <h2>Find your kind of space.</h2>
              <p>
                Choose a spot based on the sample activity levels around campus.
              </p>
            </div>

            <div className="crowd-live crowd-demo-label">
              <span />
              Demo data
            </div>
          </div>

          <div className="crowd-layout">
            <div className="crowd-main-card">
              <div className="crowd-main-top">
                <div className="crowd-main-icon">
                  <Users size={22} />
                </div>

                <div>
                  <span>Overall campus activity</span>
                  <strong>Moderate</strong>
                </div>
              </div>

              <div className="crowd-scale">
                <div className="crowd-scale-track">
                  <span style={{ width: "61%" }} />
                </div>

                <div className="crowd-scale-labels">
                  <span>Quiet</span>
                  <span>Moderate</span>
                  <span>Busy</span>
                </div>
              </div>

              <div className="crowd-main-footer">
                <span>Illustrative activity index</span>
                <strong>61 / 100</strong>
              </div>
            </div>

            <div className="crowd-recommendation">
              <div className="recommendation-icon">
                <Sparkles size={19} />
              </div>

              <p className="eyebrow">A LITTLE SUGGESTION</p>

              <h3>Looking for quiet?</h3>

              <p>
                The Central Library has the lowest sample crowd level.
                Check it out on your campus map.
              </p>

              <Link to="/map">
                Explore on map <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>

          <div className="crowd-location-grid">
            {crowdLocations.map((location, index) => {
              const Icon = location.icon;

              return (
                <Link
                  to="/map"
                  className="crowd-location"
                  key={location.name}
                  style={{ animationDelay: `${index * 90}ms` }}
                  aria-label={`Explore ${location.name} on the campus map`}
                >
                  <div className="crowd-location-top">
                    <div className="crowd-location-icon">
                      <Icon size={17} />
                    </div>

                    <span className={`crowd-badge ${crowdClass(location.crowd)}`}>
                      {location.crowd}
                    </span>
                  </div>

                  <h3>{location.name}</h3>
                  <p>{location.type}</p>

                  <div className="location-progress">
                    <span
                      className={crowdClass(location.crowd)}
                      style={{ width: `${location.percentage}%` }}
                    />
                  </div>

                  <div className="location-percent">
                    <span>Sample activity</span>
                    <strong>{location.percentage}%</strong>
                  </div>

                  <div className="crowd-location-action">
                    View location <ArrowUpRight size={14} />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* SERVICES */}

        <section className="services-section">
          <div className="section-heading dashboard-section-heading">
            <div>
              <p className="eyebrow dashboard-eyebrow">
                YOUR CAMPUS TOOLKIT / 02
              </p>
              <h2>Everything, one campus away.</h2>
              <p>Choose a service and get straight to what you need.</p>
            </div>

            <span className="services-count">
              <Zap size={15} /> 07 SERVICES
            </span>
          </div>

          <div className="feature-grid">
            {features.map((feature, index) => {
              const Icon = feature.icon;

              return (
                <Link
                  to={feature.path}
                  className={`feature-card ${feature.theme}`}
                  key={feature.title}
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <div className="feature-card-top">
                    <div className="feature-icon">
                      <Icon size={22} />
                    </div>
                    <span className="feature-card-label">{feature.label}</span>
                  </div>

                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>

                  <span className="feature-explore">
                    Explore <ArrowUpRight size={17} />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <footer className="dashboard-footer">
          <Link to="/dashboard" className="dashboard-footer-brand">
            CAMPUS<span>FLOW</span>
          </Link>
          <span>YOUR SPACE. YOUR PACE.</span>
          <span>EXPLORE SOMETHING NEW ✳</span>
        </footer>
      </main>
    </div>
  );
}