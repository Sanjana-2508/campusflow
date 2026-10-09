export type CampusRole = "student" | "faculty" | "club_organiser" | "admin";

export type CampusUser = {
  id: number;
  name: string;
  email: string;
  role: CampusRole;
};

export function dashboardPathForRole(role: CampusRole) {
  switch (role) {
    case "faculty":
      return "/faculty-dashboard";
    case "club_organiser":
      return "/club-dashboard";
    case "admin":
      return "/admin-dashboard";
    default:
      return "/dashboard";
  }
}

export type LostFoundStatus =
  | "lost"
  | "pending_verification"
  | "verified_found"
  | "closed";

export type LostFoundReport = {
  id: number;
  kind: "lost" | "found";
  status: LostFoundStatus;
  name: string;
  category: string;
  description: string;
  location: string;
  eventDate: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  isOwner: boolean;
};

export type FacultyAvailability = {
  locationStatus: "in_cabin" | "not_in_cabin";
  meetingStatus: "available" | "busy";
  label: string;
  updatedAt: string | null;
};

export type FacultyProfile = {
  id: number;
  name: string;
  department: string;
  subject: string;
  cabinRoom: string;
  building: string;
  floor: string;
  locationStatus: FacultyAvailability["locationStatus"];
  meetingStatus: FacultyAvailability["meetingStatus"];
  availabilityLabel: string;
  updatedAt: string | null;
};

export type MeetingRequest = {
  id: number;
  studentId: number;
  studentName: string;
  facultyId: number;
  facultyName: string;
  facultyDepartment: string;
  purpose: string;
  message: string;
  preferredAt: string;
  status: "pending" | "accepted" | "declined" | "completed" | "cancelled";
  facultyResponse: string;
  suggestedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;

  constructor(message: string, status: number, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }
}

let csrfToken: string | null = null;

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch("/api/auth/csrf", { credentials: "same-origin" });
  const payload = (await response.json()) as { csrfToken: string };
  csrfToken = payload.csrfToken;
  return csrfToken;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  const isFormData = init.body instanceof FormData;
  if (init.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set("X-CSRF-Token", await getCsrfToken());
  }

  const response = await fetch(path.startsWith("/api/") ? path : `/api${path}`, {
    ...init,
    method,
    headers,
    credentials: "same-origin",
  });

  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    fields?: Record<string, string>;
  };
  if (!response.ok) {
    throw new ApiError(payload.error ?? "Request failed. Please try again.", response.status, payload.fields);
  }
  return payload as T;
}