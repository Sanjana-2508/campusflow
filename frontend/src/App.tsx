import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/register";
import Dashboard from "./pages/Dashboard";
import CampusMap from "./pages/Campusmap";
import Parking from "./pages/parking";
import Facilities from "./pages/Facilities";
import Events from "./pages/Events";
import LostFound from "./pages/LostFound";
import LostFoundAdmin from "./pages/LostFoundAdmin";
import AdminRoleRequests from "./pages/AdminRoleRequests";
import RoleDashboard from "./pages/RoleDashboard";
import Notifications from "./pages/Notifications";
import FacultyDirectory from "./pages/FacultyDirectory";
import AdminFacultyProfiles from "./pages/AdminFacultyProfiles";
import { apiRequest, dashboardPathForRole, type CampusUser } from "./services/api";

function RequireAuthentication() {
  const location = useLocation();
  const [user, setUser] = useState<CampusUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiRequest<{ user: CampusUser }>("/auth/me")
      .then(({ user: currentUser }) => { if (active) setUser(currentUser); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [location.pathname]);

  if (loading) return <main className="route-auth-loading" role="status">Checking your CampusFlow session…</main>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (location.pathname === "/dashboard" && user.role !== "student") return <Navigate to={dashboardPathForRole(user.role)} replace />;
  if (location.pathname.startsWith("/faculty-dashboard") && user.role !== "faculty") return <Navigate to={dashboardPathForRole(user.role)} replace />;
  if (location.pathname.startsWith("/club-dashboard") && user.role !== "club_organiser") return <Navigate to={dashboardPathForRole(user.role)} replace />;
  if ((location.pathname.startsWith("/admin-dashboard") || location.pathname.startsWith("/admin/")) && user.role !== "admin") return <Navigate to={dashboardPathForRole(user.role)} replace />;
  return <Outlet />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<Login />} />

        <Route path="/register" element={<Register />} />

        <Route element={<RequireAuthentication />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/faculty-dashboard" element={<RoleDashboard expectedRole="faculty" />} />
          <Route path="/club-dashboard" element={<RoleDashboard expectedRole="club_organiser" />} />
          <Route path="/admin-dashboard" element={<RoleDashboard expectedRole="admin" />} />
          <Route path="/map" element={<CampusMap />} />
          <Route path="/parking" element={<Parking />} />
          <Route path="/facilities" element={<Facilities />} />
          <Route path="/events" element={<Events />} />
          <Route path="/lost-found" element={<LostFound />} />
          <Route path="/admin/lost-found" element={<LostFoundAdmin />} />
          <Route path="/admin/roles" element={<AdminRoleRequests />} />
          <Route path="/faculty-directory" element={<FacultyDirectory />} />
          <Route path="/admin/faculty" element={<AdminFacultyProfiles />} />
          <Route path="/notifications" element={<Notifications />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;