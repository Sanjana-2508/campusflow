# CampusFlow API

The API uses SQLite for persistent accounts, sessions, approved faculty profiles, cabin/meeting availability, private meeting requests, role requests, Lost & Found reports, claims, review history, and notifications. Uploaded images are decoded and re-encoded to WebP before being stored outside the public web root. The image endpoint requires a valid session.

## Setup

Use Node.js 22.5 or newer. Install and start the API:

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm start
```

Configure `DATABASE_PATH`, `UPLOAD_DIRECTORY`, and `PORT` for the deployment environment. The default local data directory is `backend/data/`. Back up the SQLite database and uploaded image directory together. Keep the upload directory private and persistent; do not expose it through a static file server.

In production, leave `CAMPUSFLOW_ALLOWED_ORIGINS` unset for same-origin deployment, or set it to an explicit comma-separated list of trusted HTTPS frontend origins when the frontend and API use separate origins. Never use a wildcard origin.

For a first Admin account, a server operator must set `CAMPUSFLOW_ADMIN_EMAIL` and `CAMPUSFLOW_ADMIN_PASSWORD` directly in a protected environment or private `.env` before starting the API. The password must be at least 12 characters. No default or example Admin credentials are provided. The API creates the account only if the email does not already exist; if it belongs to a Student it refuses startup rather than promoting that account. Remove the bootstrap password from the environment after the administrator account is created. Admin role assignment remains server-only; public registration always creates a Student.

Example first-run provisioning in PowerShell. The password is entered through a secure prompt and is not included in command history:

```powershell
$env:CAMPUSFLOW_ADMIN_EMAIL = Read-Host "Initial Admin email"
$securePassword = Read-Host "Initial Admin password" -AsSecureString
$env:CAMPUSFLOW_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new("", $securePassword).Password
npm start
Remove-Item Env:CAMPUSFLOW_ADMIN_PASSWORD
```

Public registration accepts `requestedRole` values `student`, `faculty`, or `club_organiser`. The latter two create pending entries in `role_requests`; the new account remains a Student until a different authenticated Admin approves it. Public attempts to request Admin or submit `role: "admin"` are rejected. Admins review the queue at `/admin/roles` or through `GET /api/admin/role-requests` and `POST /api/admin/role-requests/:id/review`. Verified grants are stored separately in `role_grants`, so existing Student/Admin role records and sessions migrate without promotion.

After a Faculty role request is approved, an Admin must publish that account's department, subject, cabin/room, building, and floor at `/admin/faculty`. The authenticated directory reads only published profiles. Faculty availability stores cabin presence separately from meeting availability. Meeting requests derive the Student identity from the session, are visible only to the requesting Student and assigned Faculty, and permit Student cancellation only while pending. Faculty response transitions and availability updates are scoped to the signed-in Faculty ID.

The Vite development server proxies `/api` to `http://localhost:3001`. Start the API and frontend in separate terminals (`npm run dev` from `frontend`). Production must serve the frontend and API on the same origin, terminate TLS, set `NODE_ENV=production`, and protect the database and uploads with persistent encrypted backups and appropriate filesystem permissions.

## Security notes

- Passwords are stored as salted scrypt hashes; sessions use random opaque tokens stored as SHA-256 hashes and are delivered in HttpOnly, SameSite=Strict cookies.
- Role requests do not affect permissions until a different Admin approves them. The role used by `/api/auth/me` and login is calculated server-side from the persisted Admin role or approved `role_grants` record.
- Mutations require a same-site CSRF token. Reports and images require authentication; API responses omit owner email and phone details.
- Report edits and withdrawals check the authenticated user against the server-stored owner ID. Claim submission is unique per student and report; it never changes report status. Only configured server-side administrators can review a claim or found report.
- Images are limited to 5 MiB, restricted to JPEG/PNG/WebP, decoded by Sharp, resized, and re-encoded. No client-provided file path is used.
- Configure HTTPS, database backups, log retention, monitoring, and a managed/private object store before a multi-instance production deployment. Local filesystem storage is intended for a single API instance; object storage requires a private bucket and signed/authenticated reads.

Run API integration tests with `npm test` from this directory.