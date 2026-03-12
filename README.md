<h1 align="center">ShiftSync</h1>

<p align="center">
  Multi-location staff scheduling platform for Coastal Eats restaurant group.<br/>
  Built for the Priority-Soft Full-Stack Developer Assessment.
</p>

<p align="center">
  <a href="https://shiftsync.boost-buddies.com">Live Demo</a> ·
  <a href="./apps/server/README.md">Server README</a> ·
  <a href="./apps/client/README.md">Client README</a>
</p>

---

## Overview

ShiftSync is a production-deployed scheduling platform managing shifts, staff, and labor constraints across four Coastal Eats restaurant locations spanning two US timezones (Pacific and Eastern). It addresses the six concrete operational scenarios described in the assessment with a fully working constraint engine, real-time updates, and an audit trail.

**Live URL:** https://shiftsync.boost-buddies.com  
**Repository:** https://github.com/jackjavi/shiftsync

---

## Stack

| Layer         | Technology                                                                          |
| ------------- | ----------------------------------------------------------------------------------- |
| Frontend      | Next.js 16 · TypeScript · Tailwind CSS · TanStack Query · FullCalendar · Recharts   |
| Backend       | NestJS 10 · TypeScript · Prisma 7 · PostgreSQL 16 · Socket.IO                       |
| Auth          | JWT · Passport.js · bcrypt                                                          |
| Real-time     | Socket.IO (WebSocket + long-polling fallback)                                       |
| Email         | Nodemailer + Gmail App Password (opt-in per user)                                   |
| Containers    | Docker · Docker Compose                                                             |
| Reverse Proxy | Nginx (shared multi-domain infrastructure)                                          |
| SSL           | Let's Encrypt via Certbot (auto-renew)                                              |

---

## Repository Structure

```
shiftsync/
├── apps/
│   ├── server/                    # NestJS API + Prisma + PostgreSQL
│   └── client/                    # Next.js 16 frontend
├── docker-compose.yml             # Production stack
├── docker-compose-local.yml       # Local development stack
└── infrastructure/
    └── nginx/conf.d/
        └── shiftsync.boost-buddies.com.conf   # Nginx reverse-proxy config
```

---

## Quick Start (Local)

```bash
# 1. Start the database
docker compose -f docker-compose-local.yml up db -d

# 2. Server
cd apps/server
cp .env.example .env           # set DATABASE_URL=postgresql://shiftsync:localpassword@localhost:5432/shiftsync
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run start:dev              # → http://localhost:3001/api

# 3. Client
cd apps/client
cp .env.local.example .env.local   # NEXT_PUBLIC_SERVER_URL=http://localhost:3001/api
npm install
npm run dev                    # → http://localhost:3000
```

---

## Test Credentials

All accounts are pre-seeded. Every active scenario is live immediately after seeding.

| Role         | Email                               | Password      | Scenario / Notes                         |
| ------------ | ----------------------------------- | ------------- | ---------------------------------------- |
| Admin        | `jackjavi254@gmail.com`             | `Admin1234!`  | Full platform access across all 4 locations |
| Manager West | `jackmtembete@gmail.com`            | `Manager123!` | Manages Santa Monica + Venice Beach (PT) |
| Manager East | `devjack650@gmail.com`              | `Manager123!` | Manages Miami Beach + Fort Lauderdale (ET) |
| Staff        | `jacktonmtembete@gmail.com`         | `Staff123!`   | **Sunday Night Chaos** — dropped Sunday 7pm shift |
| Staff        | `elitebrainsconsulting@gmail.com`   | `Staff123!`   | **Timezone Tangle** — certified PT + ET, 9–5 availability |
| Staff        | `javiarts@gmail.com`                | `Staff123!`   | **Overtime Trap** — 32h scheduled, Fri shift triggers warning |
| Staff        | `oddtwotips@gmail.com`              | `Staff123!`   | **Regret Swap** — PENDING swap with Alex, cancel to test |
| Staff        | `rahabmwaura96@gmail.com`           | `Staff123!`   | **Fairness Complaint** — 0 premium shifts across 2 weeks |
| Staff        | `muzillyamani@gmail.com`            | `Staff123!`   | Premium shift foil — holds 3 of 4 available premium slots |
| Staff        | `alex@coastaleats.com`              | `Staff123!`   | Swap target, certified at all 4 locations |
| Staff        | `tom@coastaleats.com`               | `Staff123!`   | **Consecutive Days** — 6 straight, Sunday triggers override |
| Staff        | `sara@coastaleats.com`              | `Staff123!`   | Under-scheduled (8h vs desired 40h) — visible in analytics |
| Staff        | `marcus@coastaleats.com`            | `Staff123!`   | East Coast coverage candidate for Sunday chaos |

---

## Six Evaluation Scenarios

### 1. Sunday Night Chaos
**Jackton** has dropped their Sunday 7pm bartender shift at Santa Monica. The DROP request is live in the Swaps page. As **Manager West**, navigate to Swaps → the open DROP request is flagged urgent. Click **Suggestions** or call `GET /api/scheduling/suggestions/:shiftId` — Alex Kim appears as a qualified replacement. Reassign from the shift detail page.

### 2. The Overtime Trap
**Javi** is already at 32 scheduled hours (4×8h Mon–Thu). A fifth 8h shift exists on Friday, currently unfilled. As **Manager West**, open the Shifts page → click the Friday line cook shift → try to assign Javi. The `what-if` panel shows `projectedWeekHours: 40`. The system returns `requiresOverride: true`. The manager must acknowledge with a documented reason before the assignment commits.

### 3. The Timezone Tangle
**Elite Brain** is certified at both Pacific (Santa Monica) and Eastern (Miami Beach) locations with `9am–5pm` recurring availability. As either manager, try assigning Elite to shifts at both locations — the constraint engine evaluates the shift time against the **location's** timezone, not a home timezone. A 9am ET shift is valid (9am is within 9–5). An 8pm ET shift blocks as unavailable (outside the 9–5 window in ET).

### 4. The Simultaneous Assignment
**Alex Kim** is certified at all four locations. Open two browser windows side by side — log in as Manager West in one and Manager East in the other. Both attempt to assign Alex to different shifts at the same time. The `$transaction`-wrapped assignment re-validates inside the write. The losing request receives a 400 and the manager's page shows an `assignment.conflict` toast in real-time via Socket.IO.

### 5. The Fairness Complaint
**Rahab Mwaura** has zero premium shifts this week and last week. **Muzilly Amani** holds 3. As **Manager East**, navigate to Analytics → Fairness Report for Miami Beach. The RadialBar chart and per-person breakdown shows the imbalance instantly. The fairness score for Rahab will be well below the location mean.

### 6. The Regret Swap
**Oddie Tips** has a PENDING swap request with Alex for Tuesday's bartender shift (reason: family event). The swap has not yet been accepted by Alex. Log in as **Oddie** → navigate to Swaps → cancel the request. Status changes to `CANCELLED`, the original assignment remains on Oddie, and Alex is notified.

---

## Constraint Engine Summary

All nine constraints are enforced on every `POST /api/scheduling/assign` call:

| Rule | Type | Threshold |
| --- | --- | --- |
| Skill mismatch | Hard block | Staff lacks required skill |
| Certification missing | Hard block | Staff not certified at location |
| Double booking | Hard block | Overlapping shift exists (any location) |
| Rest period | Hard block | < 10h between adjacent shifts |
| Unavailable | Hard block | Outside availability window |
| Daily hours | Hard block > 12h / Warning > 8h | Hours in one calendar day |
| Headcount full | Hard block | Shift slots filled |
| Weekly hours | Override required > 40h / Warning > 35h | Hours in a calendar week (Mon–Sun) |
| Consecutive days | Override required on 7th / Warning on 6th | Calendar days worked in a row |

Violations return structured JSON with human-readable messages and alternative suggestions where applicable.

---

## Architecture

```
                   ┌───────────────────────────────────────┐
                   │   SHARED NGINX  (infra-nginx)          │
                   │   ports 80 + 443  ·  SSL termination   │
                   └──────────┬─────────────────┬──────────┘
                              │                 │
             ┌────────────────┘                 └──────────────────┐
             │ shiftsync-client                  shiftsync-server   │
             │ Next.js :3000                     NestJS :3001       │
             │ proxy-network                     proxy-network      │
             └────────────────────               ────────┬──────────┘
                                                         │ shiftsync-internal
                                                  shiftsync-db
                                                  PostgreSQL :5432
                                                  (never exposed to host)
```

- **proxy-network** — external Docker network shared with the infrastructure Nginx stack. Containers are reachable by name.
- **shiftsync-internal** — private bridge. Only `shiftsync-server` can reach `shiftsync-db`.

---

## Production Deployment

### First-time Setup

```bash
# 1. Clone
git clone https://github.com/jackjavi/shiftsync.git ~/shiftsync
cd ~/shiftsync

# 2. Create root .env for docker-compose secrets
cat > .env << 'ENV'
DB_PASSWORD=strong_password_here
JWT_SECRET=at_least_32_random_chars
JWT_EXPIRES_IN=7d
USER_EMAIL=your@gmail.com
USER_PASSWORD=app_password_16_chars   # Gmail App Password (not account password)
ENV

# 3. Copy nginx config to shared infrastructure
cp infrastructure/nginx/conf.d/shiftsync.boost-buddies.com.conf \
   ~/infrastructure/nginx/conf.d/shiftsync.boost-buddies.com.conf

# 4. Build and start (HTTP only first — needed for Certbot)
docker compose up -d --build
docker exec infra-nginx nginx -s reload

# 5. Issue SSL certificate
cd ~/infrastructure
docker compose run --rm --entrypoint certbot certbot \
  certonly --webroot -w /var/www/certbot \
  --email your@email.com --agree-tos --no-eff-email \
  -d shiftsync.boost-buddies.com

# 6. Enable HTTPS block in nginx conf, then reload
docker exec infra-nginx nginx -s reload

# 7. Seed
docker exec shiftsync-server npx prisma db seed
```

### Routine Updates

```bash
# Rebuild server after code changes
git pull && docker compose up -d --build server

# Rebuild client after code changes
git pull && docker compose up -d --build client

# Wipe and reseed (drops all data)
docker exec -i shiftsync-server npx prisma db execute --stdin << 'SQL'
TRUNCATE audit_logs, notifications, swap_requests, overtime_overrides,
shift_assignments, shifts, availability_windows, user_skills,
staff_certifications, location_managers, users, skills, locations
RESTART IDENTITY CASCADE;
SQL
docker exec shiftsync-server npx prisma db seed

# Run new migrations
docker exec shiftsync-server npx prisma migrate deploy
```

> **Note:** Use `docker exec -i` (not `-it`) when piping stdin via heredoc — the `-t` flag requires a real TTY which heredoc redirection is not.

---

## Design Decisions on Intentional Ambiguities

| Ambiguity | Decision Made |
| --- | --- |
| What happens to historical data when a staff member is de-certified? | Soft delete — `revokedAt` timestamp is set on `StaffCertification`. All historical `ShiftAssignment` records are preserved unchanged. Only future assignments are blocked. |
| How should "desired hours" interact with availability windows? | Availability windows are **hard constraints** — a staff member cannot be assigned outside them regardless of desired hours. Desired hours is a **soft analytics target** used only in fairness and distribution reports. |
| When calculating consecutive days, does a 1-hour shift count the same as an 11-hour shift? | Yes — any shift of any duration counts as a worked day. The consecutive-day rule is about calendar days present at work, not duration. |
| If a shift is edited after swap approval but before it occurs, what should happen? | The swap request is automatically cancelled with notifications to all parties. The original `ShiftAssignment` is restored. The manager must re-review any swaps after editing the shift. |
| How should the system handle a location that spans a timezone boundary? | One authoritative IANA timezone per location, set at creation time. If a restaurant straddles a boundary, the manager chooses the timezone where the majority of operations occur. No split-timezone support is provided. |
| Simultaneous assignment locking strategy | Re-validation inside `prisma.$transaction` rather than `SELECT FOR UPDATE` — avoids Prisma 7 driver adapter compatibility constraints while preserving full correctness. |

---

## Known Limitations

- Email notifications require a valid Gmail App Password in `.env`. If `USER_EMAIL` / `USER_PASSWORD` are absent, the service disables itself gracefully and in-app notifications continue to work normally.
- HTML email templates are not implemented — emails are sent as plain text.
- The constraint engine evaluates availability in the **location's timezone** but does not account for DST transitions that occur mid-shift (extremely rare edge case).
- Prisma Studio (`npx prisma studio`) is not available in the Docker production container — connect to the database directly for raw inspection.

---

## Detailed Documentation

- [Server README](./apps/server/README.md) — full API reference, constraint engine rules, environment variables, database schema, module architecture
- [Client README](./apps/client/README.md) — page inventory, component architecture, state management, real-time integration, design system
