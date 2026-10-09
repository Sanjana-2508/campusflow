# CampusFlow

CampusFlow is a React + TypeScript campus portal with a Vite frontend and an Express/SQLite API for authenticated Lost & Found reports, private image uploads, student claims, and staff verification.

## Local development

Use Node.js 22.5 or newer. In separate terminals:

```powershell
cd backend
npm install
$env:CAMPUSFLOW_ADMIN_EMAIL = "campus-admin@example.edu"
$env:CAMPUSFLOW_ADMIN_PASSWORD = "choose-a-unique-password-at-least-12-chars"
npm start
```

Then start the frontend:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL, create a student account from Register, or sign in with the configured campus-staff account. The development server proxies `/api` to the API at `localhost:3001`.

See [backend/README.md](backend/README.md) for persistence, admin bootstrap, storage, deployment requirements, and API security details. Run backend integration tests with `cd backend; npm test`.

Public registration creates Student accounts. Faculty and Club Organiser choices submit approval requests; the assigned role remains Student until an administrator approves it from `/admin/roles`. Admin accounts are provisioned with the backend's one-time bootstrap environment variables and never through public registration.

The existing campus pages outside authentication and Lost & Found still contain their original demo data; this change does not replace those features.
