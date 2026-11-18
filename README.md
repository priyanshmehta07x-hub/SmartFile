# SmartFile

SmartFile is a hackathon demonstration of a government application tracking and approval platform. This repository contains a React/Vite frontend, a Java 17 / Spring Boot REST API, MySQL schema managed by JPA, and a Docker Compose database service.

## What works in this MVP

- JWT login with seeded Citizen A, Citizen B, Clerk, Officer and Admin demo identities; passwords are BCrypt encoded.
- MySQL-backed department, user, application, workflow action and complaint records. JPA creates/updates tables at startup.
- API-backed application creation and account-owned citizen records, workflow action audit history, authenticated tracking and complaint submission/listing.
- Seed of 20 fictional applications, eight departments, five demo users, plus initial audit records.
- Responsive workspace, live application search and status filters, application edit/cancel flow, staff approval actions, account-protected tracking with downloadable QR codes, data-derived analytics, CSV export, theme toggle, and explicit local demo mode when the API is unavailable.

Overview and analytics counts are computed from the records loaded for the current account. The API binds applications, complaints, tracking, and audit history to the authenticated citizen account ID; applicant names are not used as ownership credentials. Tracking requires a JWT, and unknown or other-citizen file IDs return the same not-found response. In local demo mode, citizen records are partitioned by demo email in browser storage only; this is not a substitute for server-side security. Legacy database records created before ownership was added remain unassigned and hidden from citizens until a controlled data migration assigns their `owner_user_id`. Legacy workflow records are migrated to Clerk verification or the assigned Officer queue so no Admin final-approval stage remains. An Officer can access and decide only applications assigned to that Officer's account. When the API is unavailable, demo records and changes persist in that browser's local storage only; they are not shared across devices. The UI displays local time and time zone, synchronizes its clock offset from the API health timestamp when connected, and stores backend timestamps as UTC instants. Clock accuracy still depends on the host machine's system clock being synchronized. Application cancellation is an audited status change; records are not physically deleted. This remains a hackathon MVP, not a production deployment: document storage, OCR, scheduler-based escalation, notification delivery, granular stage assignment, comprehensive admin configuration, and production authentication/deployment hardening still need implementation. Do not enter real personal information.

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

Demo password for all accounts: `SmartFile@2026`

| Role | Email |
|---|---|
| Citizen A | `citizen@smartfile.demo` |
| Citizen B | `citizen-b@smartfile.demo` |
| Clerk | `clerk@smartfile.demo` |
| Officer | `officer@smartfile.demo` |
| Admin | `admin@smartfile.demo` |

Select the account from the profile area in the sidebar or top-right account control. The backend stores demo passwords as BCrypt hashes. Local fallback mode persists in browser storage and is not shared with the server.

## API sketch

All routes are prefixed `/api`.

| Method | Route | Access |
|---|---|---|
| GET | `/health` | Public; includes the server's UTC timestamp |
| POST | `/auth/login` | Public; JSON `{ "email": "...", "password": "..." }` |
| GET | `/departments` | JWT |
| GET | `/audit` | JWT; citizens see actions for applications owned by their account |
| GET | `/applications` | JWT; citizens see only account-owned applications, staff see all |
| POST | `/applications` | JWT; citizen submission is bound to the authenticated account |
| GET | `/applications/{fileId}` | JWT; citizens can retrieve only owned applications |
| PUT | `/applications/{fileId}` | JWT; owner/staff may edit submitted/returned applications |
| DELETE | `/applications/{fileId}` | JWT; owner/staff audited cancellation, not physical deletion |
| GET | `/applications/{fileId}/history` | JWT; citizens can view history only for owned applications |
| GET | `/officers` | Clerk JWT; lists eligible Officers for file assignment |
| POST | `/applications/{fileId}/actions` | Clerk: `VERIFY`, `FORWARD`, `REJECT`, `RETURN`, `REQUEST_DOCUMENTS`; assigned Officer: `FINAL_APPROVE`, `REJECT` |
| GET | `/track/{fileId}` | JWT; citizens see only owned applications, Officers only their assigned applications |
| GET, POST | `/complaints` | JWT; citizens see only complaints owned by their account, Admin sees all |

Pass the login token as `Authorization: Bearer <token>`. Clerk must verify the application before forwarding it and select an eligible Officer using the Clerk-only `/officers` directory; the `FORWARD` action must include that Officer's `assignedOfficerEmail`. Only that assigned Officer can use `FINAL_APPROVE`; Admin has no final-approval action. Officer approval and rejection produce `Final Approved by Officer` and `Rejected by Officer` statuses. Rejection and return actions require remarks. The workflow API records each accepted action in `workflow_actions`; tracking shows the current handler and an ordered, timestamped movement history.

## Demo walkthrough

1. Sign in as Citizen A (`citizen@smartfile.demo`) or Citizen B (`citizen-b@smartfile.demo`) and submit an application. Each sees only records submitted by that account.
2. Use its generated `SF-YYYY-NNNN` file ID in Track a file.
3. Sign in as Clerk to verify documents, then forward the verified application to the designated Officer.
4. Sign in as the assigned Officer to final-approve or reject the application. Admin cannot perform workflow decisions. Citizens can track the current holder and timestamped movement history.

The seeded demo includes fictional pending, completed, returned and overdue-by-deadline examples. Restarting with the existing MySQL volume keeps records; to reset the database, stop the app and run `docker compose down -v` before bringing MySQL back up. This removes the local demo database volume.

## Build checks

- Frontend: `cd frontend && npm install && npm run build`
- Backend: `cd backend && mvn test`

No screenshots are included yet. Capture them after starting the app at your preferred browser size.
