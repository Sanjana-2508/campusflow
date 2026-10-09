import "dotenv/config";
import { createHash, randomBytes, timingSafeEqual, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { mkdir, readdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import cookieParser from "cookie-parser";
import express from "express";
import multer from "multer";
import sharp from "sharp";

const scryptAsync = promisify(scrypt);
const here = path.dirname(fileURLToPath(import.meta.url));
const categories = new Set([
  "Electronics", "Bags", "ID Cards", "Books", "Clothing", "Accessories", "Other",
]);
const sessionCookie = "campusflow_session";
const csrfCookie = "campusflow_csrf";
const sessionLifetime = 1000 * 60 * 60 * 24 * 7;

const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const isEmail = (value) => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const text = (value, max) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;

async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `${salt.toString("hex")}:${Buffer.from(hash).toString("hex")}`;
}

async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(":");
  const expected = Buffer.from(hashHex, "hex");
  const actual = Buffer.from(await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function bootstrapAdmin(db, email, password) {
  if (!email && !password) return;
  if (!isEmail(email) || typeof password !== "string" || password.length < 12) {
    throw new Error("Admin bootstrap requires a valid email and a password of at least 12 characters.");
  }
  const existing = db.prepare("SELECT role FROM users WHERE email = ?").get(email);
  if (existing) {
    if (existing.role !== "admin") {
      throw new Error("Configured admin email belongs to a non-admin account; refusing to promote it.");
    }
    return;
  }
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, 64);
  const hash = `${salt.toString("hex")}:${Buffer.from(derived).toString("hex")}`;
  db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')")
    .run("CampusFlow Administrator", email, hash);
}

function reportRow(row, viewerId) {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    name: row.name,
    category: row.category,
    description: row.description,
    location: row.location,
    eventDate: row.event_date,
    imageUrl: row.image_path ? `/api/lost-found/${row.id}/image` : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    canEdit: row.owner_id === viewerId,
    isOwner: row.owner_id === viewerId,
  };
}

function facultyProfileResponse(row) {
  return {
    id: row.id,
    name: row.name,
    department: row.department,
    subject: row.subject,
    cabinRoom: row.cabin_room,
    building: row.building,
    floor: row.floor,
    locationStatus: row.location_status,
    meetingStatus: row.meeting_status,
    availabilityLabel: row.meeting_status === "busy"
      ? row.location_status === "in_cabin" ? "In Cabin · Busy for meetings" : "Busy / Unavailable"
      : row.location_status === "in_cabin" ? "In Cabin" : "Not in Cabin",
    updatedAt: row.availability_updated_at ?? null,
  };
}

function availabilityResponse(row) {
  return {
    locationStatus: row.location_status,
    meetingStatus: row.meeting_status,
    label: row.meeting_status === "busy"
      ? row.location_status === "in_cabin" ? "In Cabin · Busy for meetings" : "Busy / Unavailable"
      : row.location_status === "in_cabin" ? "In Cabin" : "Not in Cabin",
    updatedAt: row.updated_at,
  };
}

function isFutureIsoDate(value) {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value))
    && Date.parse(value) > Date.now();
}

function meetingRow(db, id) {
  const row = db.prepare(`SELECT meeting_requests.*, student.name AS student_name,
    faculty.name AS faculty_name, faculty_profiles.department AS faculty_department
    FROM meeting_requests
    JOIN users AS student ON student.id = meeting_requests.student_id
    JOIN users AS faculty ON faculty.id = meeting_requests.faculty_id
    LEFT JOIN faculty_profiles ON faculty_profiles.user_id = faculty.id
    WHERE meeting_requests.id = ?`).get(id);
  if (!row) return null;
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    facultyId: row.faculty_id,
    facultyName: row.faculty_name,
    facultyDepartment: row.faculty_department ?? "",
    purpose: row.purpose,
    message: row.message,
    preferredAt: row.preferred_at,
    status: row.status,
    facultyResponse: row.faculty_response,
    suggestedAt: row.suggested_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createApp(options = {}) {
  const dataDirectory = path.resolve(options.dataDirectory ?? process.env.DATA_DIRECTORY ?? path.join(here, "data"));
  const uploadDirectory = path.resolve(options.uploadDirectory ?? process.env.UPLOAD_DIRECTORY ?? path.join(dataDirectory, "uploads"));
  const databasePath = path.resolve(options.databasePath ?? process.env.DATABASE_PATH ?? path.join(dataDirectory, "campusflow.sqlite"));
  await mkdir(dataDirectory, { recursive: true });
  await mkdir(uploadDirectory, { recursive: true });

  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const migrationDirectory = path.join(here, "migrations");
  const migrations = (await readdir(migrationDirectory)).filter((file) => file.endsWith(".sql")).sort();
  for (const migration of migrations) {
    db.exec(await readFile(path.join(migrationDirectory, migration), "utf8"));
  }
  await bootstrapAdmin(db, options.adminEmail ?? process.env.CAMPUSFLOW_ADMIN_EMAIL, options.adminPassword ?? process.env.CAMPUSFLOW_ADMIN_PASSWORD);

  const app = express();
  const configuredOrigins = (options.allowedOrigins ?? process.env.CAMPUSFLOW_ALLOWED_ORIGINS
    ?? (process.env.NODE_ENV === "production" ? "" : "http://localhost:5173,http://127.0.0.1:5173"))
    .split(",").map((origin) => origin.trim()).filter(Boolean);
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  const authAttempts = new Map();
  const rateLimitAuth = (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const recent = (authAttempts.get(key) ?? []).filter((stamp) => now - stamp < 60_000);
    if (recent.length >= 20) return res.status(429).json({ error: "Too many attempts. Please wait a minute and try again." });
    recent.push(now);
    authAttempts.set(key, recent);
    next();
  };

  const requireCsrf = (req, res, next) => {
    const origin = req.get("origin");
    const expectedOrigin = `${req.protocol}://${req.get("host")}`;
    if (origin && origin !== expectedOrigin && !configuredOrigins.includes(origin)) {
      return res.status(403).json({ error: "Request origin is not allowed." });
    }
    const header = req.get("x-csrf-token");
    if (!header || header !== req.cookies[csrfCookie]) return res.status(403).json({ error: "Request verification failed. Refresh and try again." });
    next();
  };

  const requireAuth = (req, res, next) => {
    const token = req.cookies[sessionCookie];
    if (!token) return res.status(401).json({ error: "Sign in to continue." });
    const session = db.prepare(`SELECT users.id, users.name, users.email,
      CASE WHEN users.role = 'admin' THEN 'admin' ELSE COALESCE(role_grants.role, 'student') END AS role
      FROM sessions JOIN users ON users.id = sessions.user_id
      LEFT JOIN role_grants ON role_grants.user_id = users.id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ?`).get(hashToken(token), Date.now());
    if (!session) {
      res.clearCookie(sessionCookie, cookieOptions());
      return res.status(401).json({ error: "Your session has expired. Sign in again." });
    }
    req.user = session;
    next();
  };

  const requireAdmin = (req, res, next) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Administrator access is required." });
    next();
  };

  const requireRole = (...roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Your account does not have access to this operation." });
    next();
  };

  const csrfForMutations = [requireCsrf];
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, callback) => {
      if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
        const error = new Error("Choose a JPEG, PNG, or WebP image.");
        error.status = 400;
        callback(error);
        return;
      }
      callback(null, true);
    },
  });

  const saveImage = async (file) => {
    if (!file) return null;
    const image = sharp(file.buffer, { limitInputPixels: 25_000_000 });
    let metadata;
    try {
      metadata = await image.metadata();
    } catch {
      const error = new Error("Choose a valid JPEG, PNG, or WebP image.");
      error.status = 400;
      throw error;
    }
    if (!new Set(["jpeg", "png", "webp"]).has(metadata.format)) {
      const error = new Error("Choose a valid JPEG, PNG, or WebP image.");
      error.status = 400;
      throw error;
    }
    const filename = `${randomBytes(24).toString("hex")}.webp`;
    await image.rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 }).toFile(path.join(uploadDirectory, filename));
    return filename;
  };

  const validateReport = (body) => {
    const errors = {};
    if (!text(body.name, 100)) errors.name = "Enter an item name (maximum 100 characters).";
    if (!categories.has(body.category)) errors.category = "Choose a valid category.";
    if (!text(body.description, 1500)) errors.description = "Enter a description (maximum 1,500 characters).";
    if (!text(body.location, 160)) errors.location = "Enter a campus location (maximum 160 characters).";
    const dateTimestamp = typeof body.eventDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.eventDate)
      ? Date.parse(`${body.eventDate}T00:00:00Z`)
      : Number.NaN;
    const validCalendarDate = !Number.isNaN(dateTimestamp)
      && new Date(dateTimestamp).toISOString().slice(0, 10) === body.eventDate;
    if (!validCalendarDate) {
      errors.eventDate = "Choose a valid date.";
    }
    if (!new Set(["lost", "found"]).has(body.kind)) errors.kind = "Choose Lost or Found.";
    return errors;
  };

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/auth/csrf", (req, res) => {
    const token = req.cookies[csrfCookie] || randomBytes(32).toString("hex");
    res.cookie(csrfCookie, token, { ...cookieOptions(), httpOnly: false });
    res.json({ csrfToken: token });
  });

  app.post("/api/auth/register", rateLimitAuth, ...csrfForMutations, async (req, res, next) => {
    try {
      const { name, email, password } = req.body ?? {};
      const requestedRole = req.body?.requestedRole ?? "student";
      if (!text(name, 100) || !isEmail(email) || typeof password !== "string" || password.length < 12 || password.length > 200) {
        return res.status(400).json({ error: "Enter your name, a valid email, and a password of at least 12 characters." });
      }
      if (!new Set(["student", "faculty", "club_organiser"]).has(requestedRole)) {
        return res.status(403).json({ error: "Admin accounts are provisioned by campus administrators. Choose Student or request Faculty/Club Organiser access." });
      }
      if (req.body?.role === "admin") {
        return res.status(403).json({ error: "Admin accounts are provisioned by campus administrators." });
      }
      const passwordHash = await hashPassword(password);
      const createAccount = db.transaction(() => {
        const result = db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'student')")
          .run(name.trim(), email.trim().toLowerCase(), passwordHash);
        const userId = Number(result.lastInsertRowid);
        const roleRequest = requestedRole === "student"
          ? null
          : Number(db.prepare("INSERT INTO role_requests (user_id, requested_role) VALUES (?, ?)")
            .run(userId, requestedRole).lastInsertRowid);
        return { userId, roleRequest };
      });
      const account = createAccount();
      createSession(db, res, account.userId);
      res.status(201).json({
        user: publicUser(db, account.userId),
        roleRequest: account.roleRequest ? { id: account.roleRequest, requestedRole, status: "pending" } : null,
      });
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "An account with that email already exists." });
      next(error);
    }
  });

  app.post("/api/auth/login", rateLimitAuth, ...csrfForMutations, async (req, res, next) => {
    try {
      const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
      const password = req.body?.password;
      const user = db.prepare("SELECT id, password_hash FROM users WHERE email = ?").get(email);
      if (!user || typeof password !== "string" || !(await verifyPassword(password, user.password_hash))) {
        return res.status(401).json({ error: "Email or password is incorrect." });
      }
      createSession(db, res, user.id);
      res.json({ user: publicUser(db, user.id) });
    } catch (error) { next(error); }
  });

  app.get("/api/auth/me", requireAuth, (req, res) => res.json({ user: req.user }));
  app.post("/api/auth/logout", ...csrfForMutations, (req, res) => {
    const token = req.cookies[sessionCookie];
    if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
    res.clearCookie(sessionCookie, cookieOptions());
    res.status(204).end();
  });

  app.get("/api/admin/role-requests", requireAuth, requireAdmin, (_req, res) => {
    const requests = db.prepare(`SELECT role_requests.id, role_requests.requested_role, role_requests.status,
      role_requests.request_note, role_requests.review_note, role_requests.requested_at,
      role_requests.reviewed_at, requester.name AS requester_name, requester.email AS requester_email,
      reviewer.name AS reviewer_name FROM role_requests
      JOIN users AS requester ON requester.id = role_requests.user_id
      LEFT JOIN users AS reviewer ON reviewer.id = role_requests.reviewer_id
      ORDER BY CASE role_requests.status WHEN 'pending' THEN 0 ELSE 1 END, role_requests.requested_at DESC LIMIT 200`).all();
    res.json({ requests, pendingCount: requests.filter((item) => item.status === "pending").length });
  });

  app.post("/api/admin/role-requests/:id/review", requireAuth, requireAdmin, ...csrfForMutations, (req, res) => {
    const { decision, notes = "" } = req.body ?? {};
    if (!new Set(["approved", "rejected"]).has(decision) || typeof notes !== "string" || notes.trim().length > 1000) {
      return res.status(400).json({ error: "Choose approve or reject and keep review notes under 1,000 characters." });
    }
    const roleRequest = db.prepare("SELECT * FROM role_requests WHERE id = ?").get(Number(req.params.id));
    if (!roleRequest || roleRequest.status !== "pending") return res.status(409).json({ error: "This role request is no longer pending review." });
    if (roleRequest.user_id === req.user.id) return res.status(403).json({ error: "Administrators cannot approve their own role requests." });
    const tx = db.transaction(() => {
      db.prepare(`UPDATE role_requests SET status = ?, reviewer_id = ?, review_note = ?, reviewed_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'pending'`).run(decision, req.user.id, notes.trim(), roleRequest.id);
      if (decision === "approved") {
        db.prepare(`INSERT INTO role_grants (user_id, role, granted_by) VALUES (?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET role = excluded.role, granted_by = excluded.granted_by,
          granted_at = CURRENT_TIMESTAMP`).run(roleRequest.user_id, roleRequest.requested_role, req.user.id);
      }
      db.prepare("INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)")
        .run(roleRequest.user_id, "Role request reviewed", decision === "approved"
          ? `Your ${roleRequest.requested_role === "club_organiser" ? "Club Organiser" : "Faculty"} access request was approved.`
          : "Your campus access request was reviewed. Sign in to submit a new request if your responsibilities change.");
    });
    tx();
    res.json({ reviewed: true, decision, role: publicUser(db, roleRequest.user_id).role });
  });

  app.get("/api/faculty", requireAuth, (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const rows = db.prepare(`SELECT users.id, users.name, faculty_profiles.department, faculty_profiles.subject,
      faculty_profiles.cabin_room, faculty_profiles.building, faculty_profiles.floor,
      COALESCE(faculty_availability.location_status, 'not_in_cabin') AS location_status,
      COALESCE(faculty_availability.meeting_status, 'available') AS meeting_status,
      faculty_availability.updated_at AS availability_updated_at
      FROM role_grants JOIN users ON users.id = role_grants.user_id
      JOIN faculty_profiles ON faculty_profiles.user_id = users.id
      LEFT JOIN faculty_availability ON faculty_availability.user_id = users.id
      WHERE role_grants.role = 'faculty'
        AND (? = '' OR lower(users.name) LIKE lower(?) OR lower(faculty_profiles.department) LIKE lower(?)
          OR lower(faculty_profiles.subject) LIKE lower(?) OR lower(faculty_profiles.building) LIKE lower(?)
          OR lower(faculty_profiles.cabin_room) LIKE lower(?))
      ORDER BY users.name COLLATE NOCASE LIMIT 250`).all(
        query, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`,
      );
    res.json({ faculty: rows.map(facultyProfileResponse) });
  });

  app.get("/api/faculty/me", requireAuth, requireRole("faculty"), (req, res) => {
    const profile = db.prepare(`SELECT faculty_profiles.department, faculty_profiles.subject,
      faculty_profiles.cabin_room, faculty_profiles.building, faculty_profiles.floor,
      COALESCE(faculty_availability.location_status, 'not_in_cabin') AS location_status,
      COALESCE(faculty_availability.meeting_status, 'available') AS meeting_status,
      faculty_availability.updated_at AS availability_updated_at
      FROM faculty_profiles LEFT JOIN faculty_availability ON faculty_availability.user_id = faculty_profiles.user_id
      WHERE faculty_profiles.user_id = ?`).get(req.user.id);
    res.json({ profile: profile ? {
      department: profile.department,
      subject: profile.subject,
      cabinRoom: profile.cabin_room,
      building: profile.building,
      floor: profile.floor,
      locationStatus: profile.location_status,
      meetingStatus: profile.meeting_status,
      updatedAt: profile.availability_updated_at,
      statusLabel: profile.meeting_status === "busy"
        ? profile.location_status === "in_cabin" ? "In Cabin · Busy for meetings" : "Busy / Unavailable"
        : profile.location_status === "in_cabin" ? "In Cabin" : "Not in Cabin",
    } : null });
  });

  app.get("/api/faculty/meetings", requireAuth, requireRole("faculty"), (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "all";
    const validStatus = new Set(["all", "pending", "accepted", "declined", "completed", "cancelled"]);
    if (!validStatus.has(status)) return res.status(400).json({ error: "Choose a valid meeting status filter." });
    const rows = db.prepare(`SELECT id FROM meeting_requests WHERE faculty_id = ? AND (? = 'all' OR status = ?)
      ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, preferred_at`).all(req.user.id, status, status);
    res.json({ requests: rows.map(({ id }) => meetingRow(db, id)) });
  });

  app.get("/api/faculty/:id", requireAuth, (req, res) => {
    const profile = db.prepare(`SELECT users.id, users.name, faculty_profiles.department, faculty_profiles.subject,
      faculty_profiles.cabin_room, faculty_profiles.building, faculty_profiles.floor,
      COALESCE(faculty_availability.location_status, 'not_in_cabin') AS location_status,
      COALESCE(faculty_availability.meeting_status, 'available') AS meeting_status,
      faculty_availability.updated_at AS availability_updated_at
      FROM role_grants JOIN users ON users.id = role_grants.user_id
      JOIN faculty_profiles ON faculty_profiles.user_id = users.id
      LEFT JOIN faculty_availability ON faculty_availability.user_id = users.id
      WHERE role_grants.role = 'faculty' AND users.id = ?`).get(Number(req.params.id));
    if (!profile) return res.status(404).json({ error: "Faculty profile not found." });
    res.json({ faculty: facultyProfileResponse(profile) });
  });

  app.get("/api/admin/faculty", requireAuth, requireAdmin, (_req, res) => {
    const rows = db.prepare(`SELECT users.id, users.name, users.email, faculty_profiles.department,
      faculty_profiles.subject, faculty_profiles.cabin_room, faculty_profiles.building, faculty_profiles.floor,
      faculty_profiles.updated_at AS profile_updated_at,
      COALESCE(faculty_availability.location_status, 'not_in_cabin') AS location_status,
      COALESCE(faculty_availability.meeting_status, 'available') AS meeting_status,
      faculty_availability.updated_at AS availability_updated_at
      FROM role_grants JOIN users ON users.id = role_grants.user_id
      LEFT JOIN faculty_profiles ON faculty_profiles.user_id = users.id
      LEFT JOIN faculty_availability ON faculty_availability.user_id = users.id
      WHERE role_grants.role = 'faculty' ORDER BY users.name COLLATE NOCASE LIMIT 500`).all();
    res.json({ faculty: rows });
  });

  app.put("/api/admin/faculty/:id", requireAuth, requireAdmin, ...csrfForMutations, (req, res) => {
    const facultyId = Number(req.params.id);
    if (!Number.isSafeInteger(facultyId) || facultyId < 1) return res.status(400).json({ error: "Choose a valid Faculty account." });
    const { department, subject = "", cabinRoom, building, floor = "" } = req.body ?? {};
    if (!text(department, 120) || !text(cabinRoom, 100) || !text(building, 120)
      || typeof subject !== "string" || subject.trim().length > 120
      || typeof floor !== "string" || floor.trim().length > 60) {
      return res.status(400).json({ error: "Department, cabin/room and building are required; optional fields must be within their length limits." });
    }
    const isFaculty = db.prepare("SELECT 1 AS valid FROM role_grants WHERE user_id = ? AND role = 'faculty'").get(facultyId);
    if (!isFaculty) return res.status(404).json({ error: "Approved Faculty account not found." });
    const tx = db.transaction(() => {
      db.prepare(`INSERT INTO faculty_profiles (user_id, department, subject, cabin_room, building, floor, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET department = excluded.department, subject = excluded.subject,
          cabin_room = excluded.cabin_room, building = excluded.building, floor = excluded.floor,
          updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`)
        .run(facultyId, department.trim(), subject.trim(), cabinRoom.trim(), building.trim(), floor.trim(), req.user.id);
      db.prepare(`INSERT INTO faculty_availability (user_id) VALUES (?)
        ON CONFLICT(user_id) DO NOTHING`).run(facultyId);
    });
    tx();
    res.json({ saved: true });
  });

  app.patch("/api/faculty/me/availability", requireAuth, requireRole("faculty"), ...csrfForMutations, (req, res) => {
    const { status } = req.body ?? {};
    if (!new Set(["in_cabin", "not_in_cabin", "busy"]).has(status)) {
      return res.status(400).json({ error: "Choose In Cabin, Not in Cabin, or Busy / Unavailable." });
    }
    if (status === "busy") {
      db.prepare(`INSERT INTO faculty_availability (user_id, meeting_status) VALUES (?, 'busy')
        ON CONFLICT(user_id) DO UPDATE SET meeting_status = 'busy', updated_at = CURRENT_TIMESTAMP`)
        .run(req.user.id);
    } else {
      db.prepare(`INSERT INTO faculty_availability (user_id, location_status, meeting_status)
        VALUES (?, ?, 'available') ON CONFLICT(user_id) DO UPDATE SET
        location_status = excluded.location_status, meeting_status = 'available', updated_at = CURRENT_TIMESTAMP`)
        .run(req.user.id, status);
    }
    const saved = db.prepare(`SELECT location_status, meeting_status, updated_at FROM faculty_availability WHERE user_id = ?`)
      .get(req.user.id);
    res.json({ availability: availabilityResponse(saved) });
  });

  app.post("/api/meetings", requireAuth, requireRole("student"), ...csrfForMutations, (req, res, next) => {
    try {
      const facultyId = Number(req.body?.facultyId);
      const { purpose, message, preferredAt } = req.body ?? {};
      if (!Number.isSafeInteger(facultyId) || facultyId < 1
        || !text(purpose, 100) || !text(message, 2000) || !isFutureIsoDate(preferredAt)) {
        return res.status(400).json({ error: "Choose a faculty member, enter a purpose and message, and select a future date and time." });
      }
      const faculty = db.prepare(`SELECT users.id, users.name FROM users
        JOIN role_grants ON role_grants.user_id = users.id AND role_grants.role = 'faculty'
        JOIN faculty_profiles ON faculty_profiles.user_id = users.id WHERE users.id = ?`).get(facultyId);
      if (!faculty) return res.status(404).json({ error: "Faculty profile not found." });
      const created = db.prepare(`INSERT INTO meeting_requests (student_id, faculty_id, purpose, message, preferred_at)
        VALUES (?, ?, ?, ?, ?)`).run(req.user.id, facultyId, purpose.trim(), message.trim(), preferredAt);
      db.prepare("INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)")
        .run(facultyId, "New student meeting request", `${req.user.name} requested a meeting about “${purpose.trim()}”.`);
      const row = meetingRow(db, Number(created.lastInsertRowid));
      res.status(201).json({ request: row });
    } catch (error) { next(error); }
  });

  app.get("/api/meetings/mine", requireAuth, requireRole("student"), (req, res) => {
    const rows = db.prepare(`SELECT id FROM meeting_requests WHERE student_id = ? ORDER BY preferred_at DESC`).all(req.user.id);
    res.json({ requests: rows.map(({ id }) => meetingRow(db, id)) });
  });

  app.post("/api/meetings/:id/cancel", requireAuth, requireRole("student"), ...csrfForMutations, (req, res) => {
    const result = db.prepare(`UPDATE meeting_requests SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND student_id = ? AND status = 'pending'`).run(Number(req.params.id), req.user.id);
    if (!result.changes) return res.status(404).json({ error: "Pending meeting request not found." });
    const request = meetingRow(db, Number(req.params.id));
    db.prepare("INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)")
      .run(request.facultyId, "Meeting request cancelled", `${request.studentName} cancelled a pending meeting request.`);
    res.json({ request });
  });

  app.patch("/api/faculty/meetings/:id", requireAuth, requireRole("faculty"), ...csrfForMutations, (req, res) => {
    const { decision, response = "", suggestedAt = null } = req.body ?? {};
    if (!new Set(["accepted", "declined", "completed"]).has(decision)
      || typeof response !== "string" || response.trim().length > 2000
      || (suggestedAt !== null && !isFutureIsoDate(suggestedAt))) {
      return res.status(400).json({ error: "Choose Accept, Decline, or Complete. Response notes must be under 2,000 characters and a suggested time must be in the future." });
    }
    const meeting = db.prepare("SELECT * FROM meeting_requests WHERE id = ? AND faculty_id = ?")
      .get(Number(req.params.id), req.user.id);
    if (!meeting) return res.status(404).json({ error: "Meeting request not found." });
    const validTransition = (meeting.status === "pending" && ["accepted", "declined"].includes(decision))
      || (meeting.status === "accepted" && decision === "completed");
    if (!validTransition) return res.status(409).json({ error: "This meeting request cannot transition to that status." });
    db.prepare(`UPDATE meeting_requests SET status = ?, faculty_response = ?, suggested_at = ?,
      updated_at = CURRENT_TIMESTAMP WHERE id = ? AND faculty_id = ?`)
      .run(decision, response.trim(), suggestedAt, meeting.id, req.user.id);
    db.prepare("INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)")
      .run(meeting.student_id, "Meeting request updated", `Your meeting request is now ${decision}${suggestedAt ? `; a suggested time is ${suggestedAt}` : ""}.`);
    res.json({ request: meetingRow(db, meeting.id) });
  });

  app.get("/api/lost-found", requireAuth, (req, res) => {
    const rows = db.prepare("SELECT * FROM reports WHERE status != 'closed' ORDER BY created_at DESC").all();
    const counts = db.prepare(`SELECT kind, status, COUNT(*) AS count FROM reports
      WHERE status != 'closed' GROUP BY kind, status`).all();
    res.json({ reports: rows.map((row) => reportRow(row, req.user.id)), counts });
  });

  app.post("/api/lost-found", requireAuth, ...csrfForMutations, upload.single("image"), async (req, res, next) => {
    let imagePath;
    try {
      const errors = validateReport(req.body);
      if (Object.keys(errors).length) return res.status(400).json({ error: "Check the highlighted fields.", fields: errors });
      imagePath = await saveImage(req.file);
      const status = req.body.kind === "found" ? "pending_verification" : "lost";
      const result = db.prepare(`INSERT INTO reports
        (owner_id, kind, status, name, category, description, location, event_date, image_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(req.user.id, req.body.kind, status, req.body.name.trim(), req.body.category,
          req.body.description.trim(), req.body.location.trim(), req.body.eventDate, imagePath);
      const row = db.prepare("SELECT * FROM reports WHERE id = ?").get(Number(result.lastInsertRowid));
      res.status(201).json({ report: reportRow(row, req.user.id) });
    } catch (error) { next(error); }
  });

  app.get("/api/lost-found/:id/image", requireAuth, (req, res) => {
    const report = db.prepare("SELECT image_path FROM reports WHERE id = ? AND status != 'closed'").get(Number(req.params.id));
    if (!report?.image_path) return res.status(404).json({ error: "Image not found." });
    res.type("image/webp").sendFile(path.join(uploadDirectory, path.basename(report.image_path)), (error) => {
      if (error && !res.headersSent) res.status(404).end();
    });
  });

  app.patch("/api/lost-found/:id", requireAuth, ...csrfForMutations, upload.single("image"), async (req, res, next) => {
    let replacement;
    try {
      const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(Number(req.params.id));
      if (!report) return res.status(404).json({ error: "Report not found." });
      if (report.owner_id !== req.user.id) return res.status(403).json({ error: "Only the report owner can change this report." });
      if (req.body.status === "closed") {
        db.prepare("UPDATE reports SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(report.id);
        if (report.image_path) await unlink(path.join(uploadDirectory, path.basename(report.image_path))).catch(() => {});
        db.prepare("UPDATE reports SET image_path = NULL WHERE id = ?").run(report.id);
        return res.json({ closed: true });
      }
      if (report.status === "verified_found") return res.status(409).json({ error: "Verified reports cannot be edited. Withdraw the report or contact campus staff." });
      const merged = {
        kind: report.kind,
        name: req.body.name ?? report.name,
        category: req.body.category ?? report.category,
        description: req.body.description ?? report.description,
        location: req.body.location ?? report.location,
        eventDate: req.body.eventDate ?? report.event_date,
      };
      const errors = validateReport(merged);
      if (Object.keys(errors).length) return res.status(400).json({ error: "Check the highlighted fields.", fields: errors });
      if (req.file) replacement = await saveImage(req.file);
      const removeImage = req.body.removeImage === "true";
      db.prepare(`UPDATE reports SET name = ?, category = ?, description = ?, location = ?, event_date = ?,
        image_path = CASE WHEN ? THEN NULL ELSE COALESCE(?, image_path) END, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(merged.name.trim(), merged.category, merged.description.trim(), merged.location.trim(), merged.eventDate, removeImage ? 1 : 0, replacement, report.id);
      if ((replacement || removeImage) && report.image_path) await unlink(path.join(uploadDirectory, path.basename(report.image_path))).catch(() => {});
      const updated = db.prepare("SELECT * FROM reports WHERE id = ?").get(report.id);
      res.json({ report: reportRow(updated, req.user.id) });
    } catch (error) { next(error); }
  });

  app.post("/api/lost-found/:id/claims", requireAuth, ...csrfForMutations, (req, res, next) => {
    try {
      const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(Number(req.params.id));
      if (!report || report.status === "closed") return res.status(404).json({ error: "Active report not found." });
      if (report.owner_id === req.user.id) return res.status(403).json({ error: "You cannot claim your own report." });
      if (report.kind !== "lost" || report.status !== "lost") return res.status(409).json({ error: "This report is not accepting claims." });
      if (!text(req.body?.notes, 1000)) return res.status(400).json({ error: "Add a short note for campus staff (maximum 1,000 characters)." });
      const claim = db.prepare("INSERT INTO claims (report_id, claimant_id, claimant_notes) VALUES (?, ?, ?)")
        .run(report.id, req.user.id, req.body.notes.trim());
      db.prepare("INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)")
        .run(report.owner_id, "A student submitted a claim", `A student may have information about “${report.name}”. Campus staff will review the claim.`);
      res.status(201).json({ claim: { id: Number(claim.lastInsertRowid), status: "pending" } });
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "You have already submitted a claim for this report." });
      next(error);
    }
  });

  app.get("/api/lost-found/:id/history", requireAuth, (req, res) => {
    const report = db.prepare("SELECT owner_id FROM reports WHERE id = ?").get(Number(req.params.id));
    if (!report) return res.status(404).json({ error: "Report not found." });
    if (report.owner_id !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "Only the report owner or campus staff can view review history." });
    res.json({ history: db.prepare(`SELECT review_history.decision, review_history.notes, review_history.created_at,
      users.name AS reviewer_name FROM review_history JOIN users ON users.id = review_history.reviewer_id
      WHERE report_id = ? ORDER BY review_history.created_at DESC`).all(Number(req.params.id)) });
  });

  app.get("/api/admin/reviews", requireAuth, requireAdmin, (_req, res) => {
    const claims = db.prepare(`SELECT claims.id, claims.report_id, claims.claimant_notes, claims.created_at,
      reports.name AS item_name, reports.category, reports.description, reports.location, reports.event_date,
      reports.image_path, claimant.name AS claimant_name, owner.name AS owner_name
      FROM claims JOIN reports ON reports.id = claims.report_id
      JOIN users AS claimant ON claimant.id = claims.claimant_id
      JOIN users AS owner ON owner.id = reports.owner_id
      WHERE claims.status = 'pending' ORDER BY claims.created_at ASC`).all()
      .map((row) => ({ ...row, reviewType: "claim", imageUrl: row.image_path ? `/api/lost-found/${row.report_id}/image` : null }));
    const foundReports = db.prepare(`SELECT reports.id AS report_id, reports.name AS item_name, reports.category,
      reports.description, reports.location, reports.event_date, reports.image_path, reports.created_at,
      users.name AS owner_name FROM reports JOIN users ON users.id = reports.owner_id
      WHERE reports.kind = 'found' AND reports.status = 'pending_verification'
      ORDER BY reports.created_at ASC`).all()
      .map((row) => ({ ...row, reviewType: "found_report", imageUrl: row.image_path ? `/api/lost-found/${row.report_id}/image` : null }));
    const history = db.prepare(`SELECT review_history.id, review_history.report_id, review_history.claim_id,
      review_history.decision, review_history.notes, review_history.created_at, users.name AS reviewer_name,
      reports.name AS item_name FROM review_history JOIN users ON users.id = review_history.reviewer_id
      JOIN reports ON reports.id = review_history.report_id ORDER BY review_history.created_at DESC LIMIT 100`).all();
    res.json({ claims, foundReports, history, pendingCount: claims.length + foundReports.length });
  });

  app.post("/api/admin/claims/:id/review", requireAuth, requireAdmin, ...csrfForMutations, (req, res) => {
    const { decision, notes = "" } = req.body ?? {};
    if (!new Set(["approved", "rejected"]).has(decision) || typeof notes !== "string" || notes.trim().length > 1000) {
      return res.status(400).json({ error: "Choose approve or reject and keep notes under 1,000 characters." });
    }
    const claim = db.prepare(`SELECT claims.*, reports.owner_id, reports.name, reports.status AS report_status
      FROM claims JOIN reports ON reports.id = claims.report_id WHERE claims.id = ?`).get(Number(req.params.id));
    if (!claim || claim.status !== "pending" || claim.report_status !== "lost") return res.status(409).json({ error: "This claim is no longer pending review." });
    const tx = db.transaction(() => {
      db.prepare(`UPDATE claims SET status = ?, reviewer_id = ?, verification_notes = ?, reviewed_at = CURRENT_TIMESTAMP
        WHERE id = ?`).run(decision, req.user.id, notes.trim(), claim.id);
      if (decision === "approved") {
        db.prepare("UPDATE reports SET status = 'verified_found', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(claim.report_id);
        const otherClaims = db.prepare("SELECT id, claimant_id FROM claims WHERE report_id = ? AND status = 'pending' AND id != ?")
          .all(claim.report_id, claim.id);
        for (const other of otherClaims) {
          const reason = "Another claim for this report was approved by campus staff.";
          db.prepare(`UPDATE claims SET status = 'rejected', reviewer_id = ?, verification_notes = ?, reviewed_at = CURRENT_TIMESTAMP
            WHERE id = ?`).run(req.user.id, reason, other.id);
          db.prepare(`INSERT INTO review_history (report_id, claim_id, reviewer_id, decision, notes) VALUES (?, ?, ?, 'rejected', ?)`)
            .run(claim.report_id, other.id, req.user.id, reason);
          db.prepare("INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)")
            .run(other.claimant_id, "Claim review complete", reason);
        }
      }
      db.prepare(`INSERT INTO review_history (report_id, claim_id, reviewer_id, decision, notes) VALUES (?, ?, ?, ?, ?)`)
        .run(claim.report_id, claim.id, req.user.id, decision, notes.trim());
      const message = decision === "approved" ? `A claim for “${claim.name}” was verified by campus staff.` : `A claim for “${claim.name}” was reviewed by campus staff.`;
      db.prepare("INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)").run(claim.owner_id, "Claim review complete", message);
      db.prepare("INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)").run(claim.claimant_id, "Claim review complete", message);
    });
    tx();
    res.json({ reviewed: true, decision });
  });

  app.post("/api/admin/reports/:id/review", requireAuth, requireAdmin, ...csrfForMutations, (req, res) => {
    const { decision, notes = "" } = req.body ?? {};
    if (!new Set(["approved", "rejected"]).has(decision) || typeof notes !== "string" || notes.trim().length > 1000) {
      return res.status(400).json({ error: "Choose approve or reject and keep notes under 1,000 characters." });
    }
    const report = db.prepare("SELECT * FROM reports WHERE id = ? AND kind = 'found' AND status = 'pending_verification'").get(Number(req.params.id));
    if (!report) return res.status(409).json({ error: "This found-item report is no longer pending review." });
    const status = decision === "approved" ? "verified_found" : "closed";
    const tx = db.transaction(() => {
      db.prepare("UPDATE reports SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, report.id);
      db.prepare("INSERT INTO review_history (report_id, reviewer_id, decision, notes) VALUES (?, ?, ?, ?)")
        .run(report.id, req.user.id, decision, notes.trim());
      db.prepare("INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)")
        .run(report.owner_id, "Found-item review complete", `Campus staff ${decision} the report for “${report.name}”.`);
    });
    tx();
    res.json({ reviewed: true, decision, status });
  });

  app.get("/api/notifications", requireAuth, (req, res) => {
    const notifications = db.prepare(`SELECT id, title, message, read_at, created_at FROM notifications
      WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`).all(req.user.id);
    res.json({ notifications });
  });

  app.patch("/api/notifications/:id/read", requireAuth, ...csrfForMutations, (req, res) => {
    const result = db.prepare("UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?")
      .run(Number(req.params.id), req.user.id);
    if (!result.changes) return res.status(404).json({ error: "Notification not found." });
    res.status(204).end();
  });

  app.patch("/api/notifications/read-all", requireAuth, ...csrfForMutations, (req, res) => {
    db.prepare("UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL")
      .run(req.user.id);
    res.status(204).end();
  });

  app.delete("/api/notifications/:id", requireAuth, ...csrfForMutations, (req, res) => {
    const result = db.prepare("DELETE FROM notifications WHERE id = ? AND user_id = ?")
      .run(Number(req.params.id), req.user.id);
    if (!result.changes) return res.status(404).json({ error: "Notification not found." });
    res.status(204).end();
  });

  app.use((error, _req, res, _next) => {
    if (error instanceof multer.MulterError) {
      return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: error.code === "LIMIT_FILE_SIZE" ? "Images must be 5 MB or smaller." : "Upload one valid image at a time." });
    }
    if (error.status) return res.status(error.status).json({ error: error.message });
    if (error.message?.includes("Input file contains unsupported image format")) return res.status(400).json({ error: "That file is not a readable image. Choose a JPEG, PNG, or WebP image." });
    console.error(error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  });

  app.locals.database = db;
  app.locals.close = () => db.close();
  return app;
}

function cookieOptions() {
  return { sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/" };
}

function createSession(db, res, userId) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = Date.now() + sessionLifetime;
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .run(hashToken(token), userId, expiresAt);
  res.cookie(sessionCookie, token, { ...cookieOptions(), httpOnly: true, expires: new Date(expiresAt) });
}

function publicUser(db, userId) {
  return db.prepare(`SELECT users.id, users.name, users.email,
    CASE WHEN users.role = 'admin' THEN 'admin' ELSE COALESCE(role_grants.role, 'student') END AS role
    FROM users LEFT JOIN role_grants ON role_grants.user_id = users.id WHERE users.id = ?`).get(userId);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3001);
  createApp().then((app) => app.listen(port, () => console.log(`CampusFlow API listening on http://localhost:${port}`)))
    .catch((error) => { console.error(error); process.exitCode = 1; });
}