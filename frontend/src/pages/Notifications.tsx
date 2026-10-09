import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  Check,
  Clock3,
  Info,
  PackageSearch,
  Megaphone,
  ParkingSquare,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "../components/navbar";
import { apiRequest } from "../services/api";
import "../styles/notifications.css";

type NotificationType =
  | "All"
  | "Events"
  | "Campus"
  | "Parking"
  | "System"
  | "Lost & Found";

type Notification = {
  id: number | string;
  title: string;
  description: string;
  time: string;
  type: Exclude<NotificationType, "All">;
  unread: boolean;
  serverId?: number;
};

const notifications: Notification[] = [
  {
    id: 1,
    title: "New campus event added",
    description:
      "Future of AI & Innovation is happening on 18 October at the Innovation Auditorium.",
    time: "10 min ago",
    type: "Events",
    unread: true,
  },
  {
    id: 2,
    title: "Parking availability updated",
    description:
      "Student Parking currently has 19 available spots.",
    time: "25 min ago",
    type: "Parking",
    unread: true,
  },
  {
    id: 3,
    title: "Campus maintenance notice",
    description:
      "The North Campus walkway will be temporarily restricted this evening.",
    time: "1 hour ago",
    type: "Campus",
    unread: true,
  },
  {
    id: 4,
    title: "Workshop registration open",
    description:
      "Frontend Development Workshop registration is now open.",
    time: "2 hours ago",
    type: "Events",
    unread: false,
  },
  {
    id: 5,
    title: "CampusFlow is up to date",
    description:
      "All CampusFlow services are currently operational.",
    time: "Yesterday",
    type: "System",
    unread: false,
  },
  {
    id: 6,
    title: "Library crowd level is low",
    description:
      "The Central Library currently has one of the lowest crowd levels on campus.",
    time: "Yesterday",
    type: "Campus",
    unread: false,
  },
];

const categories: NotificationType[] = [
  "All",
  "Events",
  "Campus",
  "Parking",
  "System",
  "Lost & Found",
];

export default function Notifications() {
  const [activeCategory, setActiveCategory] =
    useState<NotificationType>("All");

  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const [items, setItems] = useState(notifications);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    apiRequest<{ notifications: { id: number; title: string; message: string; read_at: string | null; created_at: string }[] }>("/notifications")
      .then(({ notifications: serverNotifications }) => {
        const savedItems: Notification[] = serverNotifications.map((item) => ({
          id: `lost-found-${item.id}`,
          serverId: item.id,
          title: item.title,
          description: item.message,
          time: new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
            -Math.max(0, Math.round((Date.now() - new Date(`${item.created_at.replace(" ", "T")}Z`).getTime()) / 60_000)),
            "minute",
          ),
          type: item.title.toLowerCase().includes("role request") ? "System" : "Lost & Found",
          unread: item.read_at === null,
        }));
        setItems((current) => [...savedItems, ...current.filter((item) => !item.serverId)]);
      })
      .catch(() => undefined);
  }, []);

  const filteredNotifications = useMemo(() => {
    return items.filter((notification) => {
      const matchesCategory =
        activeCategory === "All" ||
        notification.type === activeCategory;

      const matchesUnread =
        !showUnreadOnly || notification.unread;

      return matchesCategory && matchesUnread;
    });
  }, [activeCategory, showUnreadOnly, items]);

  const unreadCount = items.filter(
    (notification) => notification.unread
  ).length;

  const markAllRead = async () => {
    const serverItems = items.filter((item) => item.serverId);
    if (serverItems.length) {
      try {
        await apiRequest("/notifications/read-all", { method: "PATCH" });
      } catch (cause) {
        setActionError(cause instanceof Error ? cause.message : "Notifications could not be updated.");
        return;
      }
    }
    setActionError("");
    setItems((current) =>
      current.map((notification) => ({
        ...notification,
        unread: false,
      }))
    );
  };

  const markRead = async (id: number | string) => {
    const notification = items.find((item) => item.id === id);
    if (notification?.serverId) {
      try {
        await apiRequest(`/notifications/${notification.serverId}/read`, { method: "PATCH" });
      } catch (cause) {
        setActionError(cause instanceof Error ? cause.message : "Notification could not be updated.");
        return;
      }
    }
    setActionError("");
    setItems((current) =>
      current.map((notification) =>
        notification.id === id
          ? { ...notification, unread: false }
          : notification
      )
    );
  };

  const removeNotification = async (id: number | string) => {
    const notification = items.find((item) => item.id === id);
    if (notification?.serverId) {
      try {
        await apiRequest(`/notifications/${notification.serverId}`, { method: "DELETE" });
      } catch (cause) {
        setActionError(cause instanceof Error ? cause.message : "Notification could not be removed.");
        return;
      }
    }
    setActionError("");
    setItems((current) =>
      current.filter((notification) => notification.id !== id)
    );
  };

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case "Events":
        return CalendarDays;
      case "Parking":
        return ParkingSquare;
      case "Campus":
        return Megaphone;
      case "System":
        return Info;
      case "Lost & Found":
        return PackageSearch;
      default:
        return Bell;
    }
  };

  return (
    <div className="notifications-page">
      <Navbar />

      <main className="notifications-content">
        <header className="notifications-header">
          <div>
            <Link
              to="/dashboard"
              className="notifications-back"
            >
              ← Back to overview
            </Link>

            <p className="eyebrow">CAMPUS UPDATES</p>

            <h1>Stay in the loop.</h1>

            <p>
              Important announcements, event updates and useful campus
              information — all in one place.
            </p>
          </div>

          <div className="notification-summary">
            <div className="summary-icon">
              <Bell size={20} />
            </div>

            <div>
              <strong>{unreadCount}</strong>
              <span>unread updates</span>
            </div>
          </div>
        </header>

        <section className="notification-toolbar">
          <div className="notification-filters">
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

          <div className="notification-actions">
            <button
              className={showUnreadOnly ? "filter-active" : ""}
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            >
              <Check size={14} />
              Unread only
            </button>

            <button onClick={markAllRead}>
              Mark all as read
            </button>
          </div>
        </section>

        {actionError && <p className="notification-action-error" role="alert">{actionError}</p>}

        <section className="notification-results-header">
          <div>
            <p className="eyebrow">RECENT</p>
            <h2>Your notifications</h2>
          </div>

          <span>
            {filteredNotifications.length} update
            {filteredNotifications.length !== 1 ? "s" : ""}
          </span>
        </section>

        {filteredNotifications.length > 0 ? (
          <section className="notification-list">
            {filteredNotifications.map((notification) => {
              const Icon = getIcon(notification.type);

              return (
                <article
                  key={notification.id}
                  className={
                    notification.unread
                      ? "notification-item unread"
                      : "notification-item"
                  }
                >
                  <div className="notification-icon">
                    <Icon size={19} />
                  </div>

                  <div className="notification-body">
                    <div className="notification-topline">
                      <span className="notification-type">
                        {notification.type}
                      </span>

                      {notification.unread && (
                        <span className="unread-label">
                          New
                        </span>
                      )}
                    </div>

                    <h3>{notification.title}</h3>

                    <p>{notification.description}</p>

                    <div className="notification-time">
                      <Clock3 size={13} />
                      {notification.time}
                    </div>
                  </div>

                  <div className="notification-item-actions">
                    {notification.unread && (
                      <button
                        onClick={() => markRead(notification.id)}
                        title="Mark as read"
                      >
                        <Check size={15} />
                      </button>
                    )}

                    <button
                      onClick={() =>
                        removeNotification(notification.id)
                      }
                      title="Remove notification"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <div className="notifications-empty">
            <div>
              <Bell size={22} />
            </div>

            <h3>No notifications here</h3>

            <p>
              You're all caught up or there are no updates in this category.
            </p>

            <button
              onClick={() => {
                setActiveCategory("All");
                setShowUnreadOnly(false);
              }}
            >
              View all notifications
            </button>
          </div>
        )}
      </main>
    </div>
  );
}