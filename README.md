<h1 align="center">ShiftSync</h1>

<p align="center">
  Multi-location staff scheduling platform for Coastal Eats restaurant group.<br/>
  Built for the Priority-Soft Full-Stack Developer Assessment.
</p>

<p align="center">
  <a href="./apps/server/README.md">Server README</a> ·
  <a href="./apps/client/README.md">Client README</a>
</p>

---

## Overview

ShiftSync is a production-grade scheduling platform that manages shifts, staff, and constraints across four Coastal Eats restaurant locations spanning two US timezones. The assessment required building a complete full-stack system that addresses six specific real-world operational scenarios.

**Live URL:** https://shiftsync.boost-buddies.com  
**Server IP:** 161.97.71.138

---

## Stack

| Layer         | Technology                                                                        |
| ------------- | --------------------------------------------------------------------------------- |
| Frontend      | Next.js 16 · TypeScript · Tailwind CSS · TanStack Query · FullCalendar · Recharts |
| Backend       | NestJS 10 · TypeScript · Prisma 7 · PostgreSQL 16 · Socket.IO                     |
| Auth          | JWT · Passport.js · bcrypt                                                        |
| Real-time     | Socket.IO (WebSocket + long-polling fallback)                                     |
| Email         | Gmail OAuth2 via Nodemailer                                                       |
| Containers    | Docker · Docker Compose                                                           |
| Reverse Proxy | Nginx (shared multi-domain infrastructure)                                        |
| SSL           | Let's Encrypt via Certbot (auto-renew)                                            |

---

## Repository Structure

```
shiftsync/
├── apps/
│   ├── server/          # NestJS API + Prisma + PostgreSQL
│   └── client/          # Next.js 16 frontend
├── docker-compose.yml          # Production stack (used on server)
├── docker-compose-local.yml    # Local development stack
└── infrastructure/
    └── nginx/
        └── conf.d/
            └── shiftsync.boost-buddies.com.conf   # Nginx reverse-proxy config
```

---

## Six Evaluation Scenarios

The assessment specified six concrete scheduling problems. Each is solved end-to-end:

### 1. Sunday Night Chaos

A staff member calls out at 6pm for a 7pm shift. The system surfaces immediately qualified replacements via `GET /api/scheduling/suggestions/:shiftId` — returning only staff who have the required skill, location certification, no conflicting shifts, sufficient rest time, and are within their availability windows.

### 2. The Overtime Trap

A manager unknowingly builds a schedule that pushes an employee to 52 hours. The `GET /api/scheduling/what-if` endpoint previews the projected hours impact before any assignment is committed. Attempting to assign anyway returns a hard block requiring a documented manager override with a written reason — both the override decision and reason are captured in the audit log.

### 3. The Timezone Tangle

Staff certified at both Pacific and Eastern time locations set availability as "9am–5pm". The constraint engine evaluates availability windows in the **location's timezone**, not the staff member's home timezone. A shift at 8am Eastern is checked against 9–5 Eastern — correctly valid — rather than converting to the staff member's home timezone.

### 4. The Simultaneous Assignment

Two managers attempt to assign the same staff member at the same time. The final write is wrapped in a `prisma.$transaction` that re-validates constraints inside the transaction before committing. The losing request receives a 400 with an `assignment.conflict` Socket.IO event emitted in real-time to the manager's room.

### 5. The Fairness Complaint

A staff member claims they never receive premium (Friday/Saturday evening) shifts. The `GET /api/analytics/fairness/:locationId` endpoint computes each staff member's premium shift count, deviation from the location mean, and a 0–100 fairness score. The UI renders a RadialBar gauge and per-person breakdown.

### 6. The Regret Swap

Staff A requests a swap, Staff B accepts, then Staff A changes their mind before the manager approves. `POST /api/swaps/:id/cancel` cancels the request while leaving the original `ShiftAssignment` untouched — Staff A remains on the shift and all parties are notified.

---

## Constraint Engine

Every assignment passes through a nine-rule constraint engine before being committed:

| Rule                  | Type                                          | Threshold                        |
| --------------------- | --------------------------------------------- | -------------------------------- |
| Skill mismatch        | Hard block                                    | Staff lacks required skill       |
| Certification missing | Hard block                                    | Staff not certified at location  |
| Double booking        | Hard block                                    | Overlapping shift already exists |
| Rest period           | Hard block                                    | < 10h between adjacent shifts    |
| Unavailable           | Hard block                                    | Outside availability windows     |
| Daily hours           | Hard block at > 12h / Warning at > 8h         | Hours in a single calendar day   |
| Headcount full        | Hard block                                    | Shift already fully staffed      |
| Weekly hours          | Override required at > 40h / Warning at > 35h | Hours in a calendar week         |
| Consecutive days      | Override required on 7th day / Warning on 6th | Days in a row                    |

---

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │   SHARED NGINX (infra-nginx)          │
                    │   ports 80 + 443 · SSL termination    │
                    └──────────┬──────────────┬────────────┘
                               │              │
              ┌────────────────┐              └────────────────┐
              │ shiftsync-client               shiftsync-server │
              │ Next.js :3000                  NestJS :3001     │
              │ proxy-network                  proxy-network    │
              └────────────────┘                    │           │
                                             shiftsync-internal │
                                                    │           │
                                             shiftsync-db       │
                                             PostgreSQL :5432   │
```

- **proxy-network** — external Docker network shared with the infrastructure stack. `infra-nginx` routes traffic to both `shiftsync-client` and `shiftsync-server` by container name.
- **shiftsync-internal** — private bridge network. Only `shiftsync-server` can reach `shiftsync-db`. The database is never exposed to the host or proxy network.

---

## Production Deployment

### Prerequisites

The server already runs the shared Nginx + Certbot infrastructure stack at `~/infrastructure`. ShiftSync joins the existing `proxy-network`.

### Steps

```bash
# 1. On the server, clone the repository
git clone https://github.com/jackjavi/shiftsync.git
cd ~/shiftsync

# 2. Create the server .env file
cp apps/server/.env.example apps/server/.env
# Edit apps/server/.env with production secrets (see Server README)

# 3. Create a root .env for docker-compose secrets
cat > .env << 'ENV'
DB_PASSWORD=your_strong_db_password
JWT_SECRET=your_jwt_secret_min_32_chars
JWT_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
REDIRECT_URL=
GOOGLE_REFRESH_TOKEN=
USER_EMAIL=
USER_PASSWORD=
ENV

# 4. Copy the nginx config to the infrastructure directory
cp infrastructure/nginx/conf.d/shiftsync.boost-buddies.com.conf \
   ~/infrastructure/nginx/conf.d/shiftsync.boost-buddies.com.conf

# 5. Remove the HTTPS server block from the conf file (HTTP-only first boot)
#    Edit ~/infrastructure/nginx/conf.d/shiftsync.boost-buddies.com.conf
#    and delete everything from "# ── HTTPS: full production server" to the end

# 6. Build and start the ShiftSync stack
docker compose up -d --build

# 7. Reload nginx to pick up the new config
docker exec infra-nginx nginx -s reload

# 8. Verify HTTP routing works
curl http://shiftsync.boost-buddies.com

# 9. Issue SSL certificate
cd ~/infrastructure
docker compose run --rm --entrypoint certbot certbot \
  certonly \
  --webroot -w /var/www/certbot \
  --email jackmtembete@gmail.com \
  --agree-tos \
  --no-eff-email \
  -d shiftsync.boost-buddies.com

# 10. Re-add the HTTPS block to the nginx conf, then reload
docker exec infra-nginx nginx -s reload

# 11. Seed the database
docker exec shiftsync-server npx prisma db seed
```

---

## Local Development

```bash
# Start only the database
docker compose -f docker-compose-local.yml up db -d

# Run server with hot-reload
cd apps/server
cp .env.example .env   # set DATABASE_URL=postgresql://shiftsync:localpassword@localhost:5432/shiftsync
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run start:dev       # → http://localhost:3001/api

# Run client with hot-reload
cd apps/client
cp .env.local.example .env.local   # NEXT_PUBLIC_SERVER_URL=http://localhost:3001/api
npm install
npm run dev             # → http://localhost:3000
```

---

## Test Credentials

After seeding, use these credentials to log in:

| Role         | Email                             | Password      | Scenario                           |
| ------------ | --------------------------------- | ------------- | ---------------------------------- |
| Admin        | `jackjavi254@gmail.com`           | `Admin1234!`  | Full platform access               |
| Manager West | `jackmtembete@gmail.com`          | `Manager123!` | Santa Monica + Venice Beach (PT)   |
| Manager East | `devjack650@gmail.com`            | `Manager123!` | Miami Beach + Fort Lauderdale (ET) |
| Staff        | `jacktonmtembete@gmail.com`       | `Staff123!`   | Sunday Night Chaos                 |
| Staff        | `elitebrainsconsulting@gmail.com` | `Staff123!`   | Timezone Tangle                    |
| Staff        | `javiarts@gmail.com`              | `Staff123!`   | Overtime Trap                      |
| Staff        | `oddtwotips@gmail.com`            | `Staff123!`   | Regret Swap                        |
| Staff        | `rahabmwaura96@gmail.com`         | `Staff123!`   | Fairness Complaint                 |
| Staff        | `muzillyamani@gmail.com`          | `Staff123!`   | Premium Shift Foil                 |
| Staff        | `alex@coastaleats.com`            | `Staff123!`   | Swap Target (all locations)        |
| Staff        | `tom@coastaleats.com`             | `Staff123!`   | Consecutive Days                   |

---

## Design Decisions

| Ambiguity                             | Decision                                                                                                                                                         |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| De-certifying a staff member          | Soft delete — `revokedAt` timestamp is set. Historical assignments remain intact. Only future assignments are blocked.                                           |
| Availability windows vs desired hours | Availability windows are **hard constraints**. Desired hours are a soft analytics target used only in fairness reports.                                          |
| Consecutive days — shift duration     | Any shift of any duration counts as a worked day. A 1-hour shift counts the same as an 11-hour shift.                                                            |
| Shift edited after swap approved      | Swap is cancelled with notifications to all parties. The original assignment reverts. Manager must re-review after editing.                                      |
| Location spanning a timezone boundary | One authoritative IANA timezone per location, set at creation time. No split-timezone support.                                                                   |
| Simultaneous assignment locking       | Re-validation inside a `prisma.$transaction` rather than `SELECT FOR UPDATE` — avoids Prisma 7 driver adapter compatibility issues while preserving correctness. |

---

## Detailed Documentation

- [Server README](./apps/server/README.md) — API reference, constraint rules, environment variables, database schema
- [Client README](./apps/client/README.md) — page architecture, component structure, state management, real-time integration
