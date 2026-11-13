# SmartFile

SmartFile is a hackathon demonstration of a government application tracking and approval platform. This repository contains a React/Vite frontend, a Java 17 / Spring Boot REST API, MySQL schema managed by JPA, and a Docker Compose database service.

## What works in this MVP

- JWT login with seeded Citizen, Clerk, Officer and Admin demo identities; passwords are BCrypt encoded.
- MySQL-backed department, user, application, workflow action and complaint records. JPA creates/updates tables at startup.
- API-backed application creation, role-limited citizen application listing, workflow action audit history, public limited tracking and complaint submission/listing.
- Seed of 20 fictional applications, eight departments, four demo users, plus initial audit records.
- Responsive dashboard, search/filter views, application create flow, public tracking view, analytics visuals, CSV export, theme toggle, and demo data fallback when the API is unavailable.

The dashboard trend charts and some summary figures are illustrative hackathon sample metrics, while the application table and API operations use backend records when connected. The demo fallback operates only in browser memory and is not persistent. This is a hackathon MVP, not a production deployment: document uploads, OCR, QR image generation, scheduler-based escalation, complete notification delivery, granular stage assignment, admin configuration and full audit/analytics APIs still need implementation. Do not enter real personal information.

## Requirements

- Node.js 20+ and npm
- Java 17+
- Maven 3.9+
- Docker Desktop (or a locally running MySQL 8 server)

## Run locally

From the repository root:

1. Start MySQL: `docker compose up -d mysql`
2. Start the API in a terminal: `cd backend` then `mvn spring-boot:run`
3. Start the web app in another terminal: `cd frontend`, `npm install`, then `npm run dev`
4. Open the URL printed by Vite (usually `http://localhost:5173`). API health: `http://localhost:8080/api/health`.

Copy `.env.example` to `.env` and `frontend/.env.example` to `frontend/.env` to configure local environment values. Spring Boot reads its values from the process environment. Vite reads `VITE_API_URL` from `frontend/.env`.

Demo password for all four roles: `SmartFile@2026`

| Role | Email |
|---|---|
| Citizen | `citizen@smartfile.demo` |
| Clerk | `clerk@smartfile.demo` |
| Officer | `officer@smartfile.demo` |
| Admin | `admin@smartfile.demo` |

Select the account from the profile area in the lower sidebar or top-right account control. The backend stores demo passwords as BCrypt hashes. Local fallback mode is available if the API is down, but its changes are held in memory only.

## API sketch

All routes are prefixed `/api`.

| Method | Route | Access |
|---|---|---|
| GET | `/health` | Public |
| POST | `/auth/login` | Public; JSON `{ "email": "...", "password": "..." }` |
| GET | `/applications` | JWT; citizens see their own named applications, staff see all |
| POST | `/applications` | JWT; citizen may submit only for their own seeded name |
| GET | `/applications/{fileId}` | JWT |
| GET | `/applications/{fileId}/history` | JWT |
| POST | `/applications/{fileId}/actions` | JWT staff; JSON `{ "action": "APPROVE", "remarks": "..." }` |
| GET | `/track/{fileId}` | Public limited status fields |
| GET, POST | `/complaints` | JWT; citizens see their own, Admin sees all |

Pass the login token as `Authorization: Bearer <token>`. Rejection and return actions require remarks. The workflow API records each accepted action in `workflow_actions`.

## Demo walkthrough

1. Sign in as Citizen (`citizen@smartfile.demo`) and submit Rahul Sharma’s scholarship application. Seed data also includes a scholarship example.
2. Use its generated `SF-YYYY-NNNN` file ID in Track a file.
3. Sign in as Clerk or Officer and use the workflow action REST route to record a verification/review action. The API keeps an ordered history.
4. Sign in as Admin and inspect seeded delayed examples and complaints. Export the visible list to CSV.

The seeded demo includes fictional pending, completed, returned and overdue-by-deadline examples. Restarting with the existing MySQL volume keeps records; to reset the database, stop the app and run `docker compose down -v` before bringing MySQL back up. This removes the local demo database volume.

## Build checks

- Frontend: `cd frontend && npm install && npm run build`
- Backend: `cd backend && mvn test`

No screenshots are included yet. Capture them after starting the app at your preferred browser size.
