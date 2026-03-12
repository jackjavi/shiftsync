<h1 align="center">ShiftSync — Server</h1>

<p align="center">
  Multi-location staff scheduling API for Coastal Eats restaurant group.<br/>
  Built with NestJS 10 · Prisma 7 · PostgreSQL 16 · Socket.IO · Docker
</p>

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Module Architecture](#module-architecture)
- [Database Schema](#database-schema)
- [Prisma 7 — Driver Adapter Pattern](#prisma-7--driver-adapter-pattern)
- [Timezone Strategy](#timezone-strategy)
- [API Reference](#api-reference)
- [Constraint Rules Reference](#constraint-rules-reference)
- [Real-Time Events](#real-time-events)
- [Email Notifications](#email-notifications)
- [Seed Data](#seed-data)
- [Ambiguity Decisions](#ambiguity-decisions)
- [Known Limitations](#known-limitations)
- [Docker](#docker)

---

## Tech Stack

| Layer      | Technology                              |
| ---------- | --------------------------------------- |
| Runtime    | Node.js 22                              |
| Framework  | NestJS 10                               |
| Language   | TypeScript 5                            |
| ORM        | Prisma 7 (driver adapter pattern)       |
| Database   | PostgreSQL 16                           |
| Auth       | JWT + Passport.js + bcrypt              |
| Validation | Zod (schemas per endpoint)              |
| Real-time  | Socket.IO                               |
| Cron       | @nestjs/schedule                        |
| Events     | @nestjs/event-emitter (domain events)   |
| Email      | Nodemailer + Gmail App Password         |
| Containers | Docker + Docker Compose                 |

---

## Getting Started

### Prerequisites

- Node.js 22+
- Docker Desktop (for the database)

### Installation

```bash
cd apps/server
npm install
cp .env.example .env      # fill in values — see Environment Variables below

# Start the database
docker compose -f ../../docker-compose-local.yml up db -d

# Run migrations and seed
npx prisma migrate dev --name init
npx prisma db seed

# Start with hot-reload
npm run start:dev
```

Server runs at: `http://localhost:3001/api`

### Scripts

```bash
npm run start:dev     # Development with hot-reload (ts-node)
npm run build         # Compile TypeScript → dist/
npm run start:prod    # Run compiled dist/src/main
npm run lint          # ESLint
```

### Useful Prisma Commands

```bash
npx prisma migrate dev --name <description>   # create + apply a new migration
npx prisma migrate deploy                      # apply pending migrations (production)
npx prisma migrate reset --force               # drop all tables and re-apply from scratch
npx prisma db seed                             # run seed.ts only
npx prisma studio                              # visual DB browser at localhost:5555
npx prisma generate                            # regenerate client after schema changes
npx prisma validate                            # validate schema syntax
```

---

## Environment Variables

Create `apps/server/.env`:

| Variable       | Required | Default                   | Description                                                          |
| -------------- | -------- | ------------------------- | -------------------------------------------------------------------- |
| `DATABASE_URL` | ✅       | —                         | PostgreSQL connection string. Use `localhost:5432` locally, `db:5432` in Docker. |
| `JWT_SECRET`   | ✅       | —                         | Secret for signing JWT tokens. Minimum 32 characters recommended.   |
| `JWT_EXPIRES_IN` | ❌     | `7d`                      | JWT expiry duration (e.g. `7d`, `24h`).                              |
| `PORT`         | ❌       | `3001`                    | HTTP port the server listens on.                                     |
| `NODE_ENV`     | ❌       | `development`             | Set to `production` in Docker.                                       |
| `CLIENT_URL`   | ❌       | `http://localhost:3000`   | CORS allowed origin. In production: `https://shiftsync.boost-buddies.com`. |
| `USER_EMAIL`   | ❌       | —                         | Gmail address for sending notification emails. Service disables gracefully if absent. |
| `USER_PASSWORD`| ❌       | —                         | Gmail **App Password** (16-char code from myaccount.google.com/apppasswords). Not your account password. |

Example `.env` for local development:

```env
DATABASE_URL=postgresql://shiftsync:localpassword@localhost:5432/shiftsync
JWT_SECRET=local_dev_secret_min_32_chars_here
JWT_EXPIRES_IN=7d
PORT=3001
NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

---

## Module Architecture

```
src/
├── main.ts                          # Bootstrap, global prefix /api, pipes
├── app.module.ts                    # Root module — imports all feature modules
└── modules/
    ├── prisma/                      # PrismaService (Prisma 7 driver adapter)
    ├── auth/                        # JWT strategy, Passport guards, /auth/login, /auth/me
    ├── users/                       # CRUD, skills, certifications, profile
    ├── locations/                   # Location CRUD, manager assignments, staff list
    ├── skills/                      # Skill CRUD
    ├── availability/                # Availability window CRUD per user
    ├── shifts/                      # Shift CRUD, publish/unpublish, week-publish
    ├── scheduling/                  # Constraint engine, assign, validate, what-if, suggestions
    ├── swaps/                       # Swap/drop lifecycle: create→accept→approve→cancel
    ├── overtime/                    # Weekly hours tracking, dashboard, overrides
    ├── analytics/                   # Fairness report, hours distribution, on-duty-now
    ├── notifications/               # In-app notification inbox, mark-read
    ├── audit/                       # Audit log queries, CSV export
    ├── email/                       # Nodemailer email service (opt-in)
    ├── realtime/                    # Socket.IO gateway + on-duty cron (every 10s)
    └── shared/                      # Guards, decorators, pipes, types
        ├── decorators/              # @Public(), @Roles(), @CurrentUser()
        ├── guards/                  # JwtAuthGuard (global), RolesGuard
        ├── pipes/                   # ZodValidationPipe
        └── types/                   # AuthenticatedUser interface
```

### Key Patterns

**Global JWT Guard** — `JwtAuthGuard` is registered as a global `APP_GUARD`. All routes are protected by default. Routes that must be public (login, register) use `@Public()` to opt out.

**Zod Validation** — request bodies are validated via `ZodValidationPipe` applied per endpoint, not globally. This gives per-endpoint error messages with field-level detail.

**Domain Events** — mutations emit events via `@nestjs/event-emitter` (`notification.created`, `schedule.published`, `assignment.created`, `assignment.conflict`, `swap.created`, `swap.approved`, `shift.updated`). The Socket.IO gateway and `AuditService` listen for these events rather than being called directly, keeping modules decoupled.

**Concurrent Assignment** — `SchedulingService.assign()` wraps the final write in `prisma.$transaction`. Constraint validation runs again inside the transaction so two simultaneous requests cannot both succeed for the same staff member.

---

## Database Schema

13 models across the following groups:

### Users & Auth
- **User** — email, passwordHash, name, role (ADMIN/MANAGER/STAFF), desiredHoursPerWeek, emailNotificationsEnabled, isActive
- **LocationManager** — composite key (userId, locationId) — which managers run which locations
- **StaffCertification** — composite key (userId, locationId), revokedAt for soft-delete

### Scheduling
- **Location** — name, address, timezone (IANA string), isActive
- **Skill** — name (unique): bartender, line_cook, server, host
- **UserSkill** — composite key (userId, skillId)
- **AvailabilityWindow** — RECURRING (dayOfWeek 0–6) or ONE_OFF (specific date), startTime/endTime as "HH:MM" strings, isAvailable flag
- **Shift** — locationId, skillId, startAt/endAt (UTC), headcount, isPublished, isPremium, editCutoffHours
- **ShiftAssignment** — unique (shiftId, userId), status: ASSIGNED/DROPPED/SWAPPED, assignedBy

### Operations
- **SwapRequest** — shiftId, requesterId, targetId (null for DROP), type (SWAP/DROP), status lifecycle, expiresAt, resolvedBy
- **OvertimeOverride** — userId, weekStart (Mon UTC midnight), reason, authorizedBy

### Observability
- **Notification** — userId, NotificationType enum, title, body, isRead, metadata (JSON)
- **AuditLog** — actorId, entityType, entityId, action, before/after JSON snapshots, ipAddress

### Important Schema Notes

- All datetimes are stored as **UTC**. Display conversion happens in the client.
- `StaffCertification.revokedAt` is nullable — null means active, a timestamp means revoked (soft delete).
- `Shift.isPremium` is auto-set at creation for Friday/Saturday shifts at or after 17:00 in the location's timezone.
- `Shift.editCutoffHours` defaults to 48 — prevents edits within 48 hours of shift start.
- `AvailabilityWindow` strings (`startTime`, `endTime`) are evaluated against the **location's IANA timezone** at validation time.
- Prisma client is generated to `src/generated/prisma-client` (custom output path). Import from this path in application code, not from `@prisma/client`.

---

## Prisma 7 — Driver Adapter Pattern

Prisma 7 requires an explicit driver adapter instead of the built-in Rust binary engine. `PrismaService` creates a `pg.Pool` and wraps it with `PrismaPg`:

```typescript
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma-client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
```

`prisma.config.ts` at the server root configures the migration engine. It must **not** import `dotenv` (Prisma 7 handles env loading itself) and must **not** include a `seed` key (seed is configured in `package.json`).

---

## Timezone Strategy

All datetimes are stored as UTC in the database. Timezone conversion happens only at validation and display boundaries:

1. **Shift creation** — input datetimes are expected as ISO 8601 UTC strings. The frontend converts local time to UTC before sending.
2. **Availability evaluation** — when checking if a staff member is available for a shift, the shift's UTC start time is converted to the **location's IANA timezone**, then compared against the `HH:MM` availability window strings. This is the correct resolution of the Timezone Tangle scenario — availability is relative to where the work occurs, not where the staff member lives.
3. **Display** — the client uses `date-fns-tz` / `formatInTz()` to display all times in the location's timezone.

**Consequence for Elite Brain (Timezone Tangle):** Elite has `9:00–17:00` recurring availability on all days.
- Santa Monica (PT) shift at 10am PT: 10:00 is within 9–17 ✅
- Miami Beach (ET) shift at 9am ET: 9:00 is within 9–17 ✅  
- Miami Beach shift at 8pm ET: 20:00 is outside 9–17 → blocked as UNAVAILABLE ❌

The system has no concept of Elite's "home timezone" — availability is always evaluated in the location's timezone.

---

## API Reference

All endpoints are prefixed `/api`. All protected endpoints require:

```
Authorization: Bearer <access_token>
```

Responses follow the shape `{ "data": ... }` for success and `{ "message": "...", ... }` for errors.

---

### Auth

#### `POST /api/auth/login` 🌐 Public

```json
// Body
{ "email": "string", "password": "string" }

// Response 200
{ "access_token": "eyJ...", "user": { "id": 1, "email": "...", "role": "ADMIN", "name": "..." } }
```

#### `GET /api/auth/me` 🔒

Returns the full user record (including `emailNotificationsEnabled`, `desiredHoursPerWeek`) for the current JWT holder. Used by the client on every page load to refresh user state.

---

### Users

#### `POST /api/users/register` 🌐 Public
Self-register as STAFF. Body: `{ email, password, name }`. Returns user object.

#### `POST /api/users` 🔒 ADMIN
Create any role. Body: `{ email, password, name, role, desiredHoursPerWeek? }`.

#### `GET /api/users` 🔒 ADMIN, MANAGER
Query: `page`, `limit`, `role`, `locationId`. Returns paginated users with skills and certifications included.

#### `GET /api/users/me` 🔒 Any
Own full profile with skills, certifications, and availability windows.

#### `GET /api/users/:id` 🔒 ADMIN, MANAGER

#### `PATCH /api/users/me` 🔒 Any
Update own `name`, `desiredHoursPerWeek`, `emailNotificationsEnabled`.

#### `PATCH /api/users/:id` 🔒 ADMIN

#### `POST /api/users/:id/skills` 🔒 ADMIN, MANAGER
Body: `{ skillId: number }`.

#### `DELETE /api/users/:id/skills/:skillId` 🔒 ADMIN, MANAGER

#### `POST /api/users/:id/certifications` 🔒 ADMIN, MANAGER
Body: `{ locationId: number }`. Creates or re-activates (clears `revokedAt`) a certification.

#### `DELETE /api/users/:id/certifications/:locationId` 🔒 ADMIN, MANAGER
Soft delete — sets `revokedAt`. Historical assignments are preserved.

---

### Locations

#### `POST /api/locations` 🔒 ADMIN
Body: `{ name, address, timezone }`. Timezone must be a valid IANA string (e.g. `"America/Los_Angeles"`).

#### `GET /api/locations` 🔒 Any
ADMIN: all. MANAGER: only their assigned locations. STAFF: all active.

#### `GET /api/locations/:id` 🔒 Any
Includes managers list and certified staff.

#### `PATCH /api/locations/:id` 🔒 ADMIN

#### `POST /api/locations/:id/managers` 🔒 ADMIN
Body: `{ userId: number }`.

#### `DELETE /api/locations/:id/managers/:userId` 🔒 ADMIN

#### `GET /api/locations/:id/staff` 🔒 ADMIN, MANAGER
All active certified staff for a location.

---

### Skills

#### `POST /api/skills` 🔒 ADMIN — Body: `{ name: string }`
#### `GET /api/skills` 🔒 Any
#### `DELETE /api/skills/:id` 🔒 ADMIN

---

### Availability

Staff set availability windows that are evaluated in the location's timezone during constraint checking.

#### `POST /api/availability` 🔒 Any (own availability)

**Recurring window:**
```json
{ "type": "RECURRING", "dayOfWeek": 1, "startTime": "09:00", "endTime": "17:00", "isAvailable": true, "note": "optional" }
```
`dayOfWeek`: 0 = Sunday … 6 = Saturday.

**One-off exception:**
```json
{ "type": "ONE_OFF", "date": "2026-03-15T00:00:00.000Z", "startTime": "00:00", "endTime": "23:59", "isAvailable": false, "note": "Holiday" }
```
`isAvailable: false` creates a blocked window. One-off windows take precedence over recurring windows on the same date.

If no availability windows are defined for a user, they are considered available at all times.

#### `GET /api/availability/me` 🔒 Any
#### `GET /api/availability/user/:userId` 🔒 ADMIN, MANAGER
#### `PATCH /api/availability/:id` 🔒 Owner only
#### `DELETE /api/availability/:id` 🔒 Owner only

---

### Shifts

#### `POST /api/shifts` 🔒 ADMIN, MANAGER
Managers can only create shifts for their assigned locations.

```json
{
  "locationId": 1,
  "skillId": 1,
  "startAt": "2026-03-20T18:00:00.000Z",
  "endAt": "2026-03-20T23:00:00.000Z",
  "headcount": 2,
  "notes": "Busy Friday night",
  "editCutoffHours": 48
}
```

`isPremium` is automatically set `true` for Friday/Saturday shifts whose local start time (in the location's timezone) is at or after 17:00.

#### `GET /api/shifts` 🔒 Any

| Query param   | Type         | Description                                 |
| ------------- | ------------ | ------------------------------------------- |
| `locationId`  | number       | Filter by location                          |
| `skillId`     | number       | Filter by required skill                    |
| `from`        | ISO datetime | Shifts starting at or after this time (UTC) |
| `to`          | ISO datetime | Shifts starting before this time (UTC)      |
| `isPublished` | boolean      | Filter by published status                  |
| `page`        | number       | Page (default: 1)                           |
| `limit`       | number       | Per page (default: 20, max: 100)            |

STAFF receive only published shifts. MANAGER receive all shifts for their locations. ADMIN receive all shifts.

#### `GET /api/shifts/:id` 🔒 Any
Full shift detail with assignments array and pending swap requests.

#### `PATCH /api/shifts/:id` 🔒 ADMIN, MANAGER
Blocked within `editCutoffHours` of shift start. Editing automatically cancels pending swap requests for that shift.

#### `DELETE /api/shifts/:id` 🔒 ADMIN, MANAGER

#### `POST /api/shifts/:id/publish` 🔒 ADMIN, MANAGER
Sets `isPublished: true` and `publishedAt: now`. Emits `schedule.published` event.

#### `POST /api/shifts/:id/unpublish` 🔒 ADMIN, MANAGER
Blocked within the edit cutoff window.

#### `POST /api/shifts/publish-week` 🔒 ADMIN, MANAGER
Publishes all unpublished shifts for a location in a given week.
```json
{ "locationId": 1, "weekStart": "2026-03-16T00:00:00.000Z" }
```

---

### Scheduling & Constraint Engine

#### `GET /api/scheduling/validate` 🔒 ADMIN, MANAGER
Dry-run — checks all nine constraints without committing. Query: `userId`, `shiftId`.

```json
// Response 200
{
  "data": {
    "isValid": false,
    "violations": [
      { "rule": "SKILL_MISMATCH", "message": "Javi does not have the required skill: bartender", "details": {} }
    ],
    "warnings": [
      { "rule": "WEEKLY_HOURS_EXCEEDED", "message": "Javi will work 37 hours this week (approaching 40h threshold)", "details": { "projectedHours": 37 } }
    ],
    "suggestions": [
      { "userId": 7, "userName": "Alex Kim", "reason": "Has bartender skill, certified at Santa Monica, available" }
    ]
  }
}
```

#### `POST /api/scheduling/assign` 🔒 ADMIN, MANAGER

```json
// Body
{
  "userId": 3,
  "shiftId": 14,
  "forceOverride": false,
  "overrideReason": "Emergency coverage — approved by district manager"
}
```

Set `forceOverride: true` to bypass overtime and consecutive-day override requirements. `overrideReason` is required when `forceOverride: true` — it is written to the audit log.

```json
// Response 201 — success
{ "data": { "assignment": { "id": 5, "shiftId": 14, "userId": 3, "status": "ASSIGNED" }, "warnings": [] } }

// Response 400 — hard violation
{ "message": "Assignment violates scheduling constraints", "violations": [...], "suggestions": [...] }

// Response 400 — override required
{ "message": "Assignment requires manager override", "violations": [...], "requiresOverride": true }
```

#### `DELETE /api/scheduling/assign/:assignmentId` 🔒 ADMIN, MANAGER
Removes an assignment. The slot becomes available for reassignment.

#### `GET /api/scheduling/what-if` 🔒 ADMIN, MANAGER
Preview hours impact before committing. Query: `userId`, `shiftId`.

```json
// Response 200
{
  "data": {
    "currentWeekHours": 32,
    "newShiftHours": 8,
    "projectedWeekHours": 40,
    "wouldTriggerOvertimeWarning": true,
    "wouldExceedOvertimeLimit": false,
    "overtimeHours": 0
  }
}
```

#### `GET /api/scheduling/suggestions/:shiftId` 🔒 ADMIN, MANAGER
Returns all staff who can immediately cover the shift — passes all nine constraints. Used for the Sunday Night Chaos fast-path.

```json
// Response 200
{ "data": [{ "userId": 7, "userName": "Alex Kim", "reason": "Has bartender skill, certified at Santa Monica, available" }] }
```

---

### Swaps & Drop Requests

#### `POST /api/swaps` 🔒 Any (own shifts only)
Staff cannot have more than 3 pending requests at once.

```json
// SWAP request (Staff A → Staff B)
{ "shiftId": 1, "targetId": 7, "type": "SWAP", "note": "Family event Tuesday" }

// DROP request (open pickup)
{ "shiftId": 14, "type": "DROP", "note": "Sick — need coverage" }
```
DROP requests automatically expire 24 hours before the shift starts.

#### `GET /api/swaps` 🔒 Any
Query: `status`, `type`. STAFF see only their own. MANAGER see their location's. ADMIN see all.

#### `GET /api/swaps/:id` 🔒 Any

#### `POST /api/swaps/:id/accept` 🔒 Staff (target of swap)
Staff B accepts a SWAP request. Status moves to `ACCEPTED`. Manager is notified.

#### `POST /api/swaps/:id/reject` 🔒 Staff (target)
Staff B rejects. Status → `REJECTED`. Requester is notified.

#### `POST /api/swaps/:id/approve` 🔒 ADMIN, MANAGER
Manager approves an `ACCEPTED` swap. Wrapped in `$transaction`: swaps the `ShiftAssignment` records and notifies all parties.
Body: `{ note?: string }`

#### `POST /api/swaps/:id/cancel` 🔒 Requester (Staff A) or MANAGER
Cancels a PENDING or ACCEPTED request. Original assignment is untouched. All parties notified.

#### `POST /api/swaps/:id/pickup` 🔒 Any qualified staff
Pick up an open DROP. Triggers the same accept → approve flow.

---

### Overtime

#### `GET /api/overtime/weekly/:userId` 🔒 ADMIN, MANAGER
Weekly hours summary for a staff member for a given week. Query: `weekStart` (ISO UTC Monday).

#### `GET /api/overtime/weekly/me` 🔒 Any
Own weekly hours summary.

#### `GET /api/overtime/dashboard/:locationId` 🔒 ADMIN, MANAGER
All staff at a location with their projected week hours, overtime flags, and consecutive day counts.

```json
// Response 200
{
  "data": {
    "weekStart": "2026-03-09T00:00:00.000Z",
    "staffAtRisk": 2,
    "staff": [
      {
        "userId": 3,
        "userName": "Javi Arts",
        "email": "javiarts@gmail.com",
        "desiredHours": 35,
        "totalOvertimeHours": 0,
        "hasOvertimeWarning": true,
        "hasOvertimeViolation": false,
        "consecutiveDays": 4,
        "hasConsecutiveDayWarning": false,
        "requiresOverride": false
      }
    ]
  }
}
```

---

### Analytics & Fairness

#### `GET /api/analytics/hours/:locationId` 🔒 ADMIN, MANAGER
Hours distribution per staff member for a date range. Query: `from`, `to`.

#### `GET /api/analytics/fairness/:locationId` 🔒 ADMIN, MANAGER
Premium shift fairness report. Query: `from`, `to`.

Returns per-staff premium shift count, deviation from location mean, and a `fairnessScore` (0–100). Scores below 40 indicate significant under-allocation. This is the direct answer to the Fairness Complaint scenario.

#### `GET /api/analytics/on-duty` 🔒 ADMIN, MANAGER
Current on-duty staff per location at this exact moment. Also pushed every 10 seconds via Socket.IO `on-duty.update` events to all connected `location:<id>` rooms.

---

### Notifications

#### `GET /api/notifications` 🔒 Any
Own notifications, newest first. Query: `page`, `limit`. Returns unread count in response metadata.

#### `PATCH /api/notifications/:id/read` 🔒 Owner
Mark a single notification read.

#### `PATCH /api/notifications/read-all` 🔒 Any
Mark all own notifications read.

---

### Audit Trail

#### `GET /api/audit` 🔒 ADMIN
Paginated log. Query: `entityType`, `from`, `to`, `page`, `limit`.

#### `GET /api/audit/export` 🔒 ADMIN
Download filtered audit log as UTF-8 BOM CSV (Excel-compatible). Same query params as list. Streamed directly — no intermediate file.

#### `GET /api/audit/shift/:id` 🔒 ADMIN, MANAGER
Full history for a specific shift — all create/update/publish/assign/unassign events.

---

## Constraint Rules Reference

### Hard Violations — block assignment entirely

| Rule | Condition |
| --- | --- |
| `SKILL_MISMATCH` | Staff does not have the skill required by the shift |
| `CERTIFICATION_MISSING` | Staff has no active (non-revoked) certification at the shift's location |
| `DOUBLE_BOOKING` | Staff already has an overlapping assigned shift (checked across all locations) |
| `REST_PERIOD` | Fewer than 10 hours between the end of any adjacent shift and the start of this one |
| `UNAVAILABLE` | Shift falls outside the staff member's availability windows for that location's timezone |
| `DAILY_HOURS_HARD` | Assignment would cause the staff member to exceed 12 hours in one calendar day |
| `HEADCOUNT_FULL` | The shift's headcount slots are already fully assigned |

### Warnings — returned but do not block

| Rule | Condition |
| --- | --- |
| `DAILY_HOURS_WARNING` | Assignment would cause the staff member to exceed 8 hours in one day |
| `WEEKLY_HOURS_WARNING` | Projected weekly hours > 35h (approaching 40h threshold) |
| `CONSECUTIVE_DAY_WARNING` | Staff would work 6 calendar days in a row |

### Override Required — blocked unless `forceOverride: true` + reason

| Rule | Condition |
| --- | --- |
| `WEEKLY_HOURS_EXCEEDED` | Projected weekly hours > 40h |
| `CONSECUTIVE_DAYS_EXCEEDED` | Staff would work 7 calendar days in a row |

Override reason is recorded in `OvertimeOverride` and the audit log. The reason is required — passing `forceOverride: true` without `overrideReason` returns a 400.

---

## Real-Time Events

The Socket.IO gateway (`/`) handles room management and domain event forwarding.

### Client → Server (room joins)

| Event | Payload | Effect |
| --- | --- | --- |
| `join:user` | `{ userId: number }` | Joins `user:<id>` room for personal notifications |
| `join:location` | `{ locationId: number }` | Joins `location:<id>` room for location-scoped updates |
| `join:admin` | — | Joins `admin` room |

### Server → Client (emitted events)

| Event | Recipient room | Trigger |
| --- | --- | --- |
| `notification` | `user:<id>` | Any new notification created |
| `schedule.published` | `location:<id>` | Week schedule published |
| `shift.updated` | `location:<id>` | Shift edited |
| `assignment.created` | `user:<id>` + `location:<id>` | Staff assigned to shift |
| `assignment.conflict` | `user:<actorId>` | Concurrent assignment race detected |
| `swap.requested` | `user:<targetId>` | Swap request sent to Staff B |
| `swap.new_drop` | `location:<id>` | New DROP request created |
| `swap.approved` | `user:<requesterId>` + `user:<targetId>` | Manager approved a swap |
| `on-duty.update` | `location:<id>` | Pushed every 10 seconds by the on-duty cron |

The `assignment.conflict` event is the real-time signal for the Simultaneous Assignment scenario — the losing manager's browser receives this event and displays an immediate warning toast without polling.

---

## Email Notifications

Email is handled by `EmailService` using Nodemailer with Gmail SMTP and an App Password (not OAuth2).

**Setup:**
1. Enable 2-Step Verification on the Gmail account
2. Generate an App Password at `myaccount.google.com/apppasswords` (select "Mail" + your device)
3. Set in `.env`:
   ```
   USER_EMAIL=your@gmail.com
   USER_PASSWORD=xxxx xxxx xxxx xxxx
   ```

If either variable is absent or the SMTP connection fails on startup, `EmailService` disables itself and logs a warning. In-app notifications continue to work normally.

Users opt in to email notifications per their profile settings (`emailNotificationsEnabled`). The default is `false` — in-app only.

**Test the email service:**
```bash
cd apps/server
npx ts-node --compiler-options '{"module":"CommonJS"}' test-email.ts
```

---

## Seed Data

`npx prisma db seed` populates three weeks of data:

**Last week** — historical data for analytics: Javi's overtime pattern, Tom's consecutive-day history, Muzilly's premium shift accumulation, Rahab's non-premium history.

**This week** — all six assessment scenarios active and live:

| Scenario | Seeded State |
| --- | --- |
| Sunday Night Chaos | Jackton assigned to Sunday 7pm shift with a PENDING DROP request |
| Overtime Trap | Javi at 32h (4×8h shifts), Friday shift unfilled — assigning Javi triggers 40h override |
| Timezone Tangle | Elite Brain certified PT+ET with 9am–5pm availability, two shifts assigned |
| Fairness Complaint | Rahab 0 premium shifts (2 weeks), Muzilly 3 premium shifts |
| Regret Swap | Oddie has a PENDING swap with Alex for Tuesday — cancel as Oddie |
| Consecutive Days | Tom assigned 6 straight days (Mon–Sat), Sunday shift present but unassigned |

**Next week** — 7 shifts (5 published, 2 drafts) so the calendar has data when navigating forward.

**Additional seeded items:**
- 12 pre-seeded notifications across all users
- 4 audit log entries demonstrating the trail
- 1 overtime override for Tom from last week (documented as BUSINESS_NECESSITY)
- 4 swap requests in different states: PENDING DROP, PENDING SWAP, ACCEPTED, REJECTED

### Wipe and Reseed

```bash
# Local
docker exec -i shiftsync-db-local psql -U shiftsync -d shiftsync -c "
TRUNCATE audit_logs, notifications, swap_requests, overtime_overrides,
shift_assignments, shifts, availability_windows, user_skills,
staff_certifications, location_managers, users, skills, locations
RESTART IDENTITY CASCADE;"
npx prisma db seed

# Production (note: -i not -it)
docker exec -i shiftsync-server npx prisma db execute --stdin << 'SQL'
TRUNCATE audit_logs, notifications, swap_requests, overtime_overrides,
shift_assignments, shifts, availability_windows, user_skills,
staff_certifications, location_managers, users, skills, locations
RESTART IDENTITY CASCADE;
SQL
docker exec shiftsync-server npx prisma db seed
```

---

## Ambiguity Decisions

| Ambiguity from Assessment | Decision |
| --- | --- |
| De-certifying a staff member — what happens to history? | Soft delete via `revokedAt` on `StaffCertification`. All historical `ShiftAssignment` records are left intact. Only future assignments are blocked. The certification can be re-activated by granting it again. |
| How should desired hours interact with availability windows? | Availability windows are **hard constraints** and always enforced. Desired hours is a **soft analytics target** — it affects the fairness report and the under/over-scheduled flags but never blocks assignment. |
| Does a 1-hour shift count the same as an 11-hour shift for consecutive days? | Yes — any shift of any duration on a calendar day counts that day as worked. The rule is about days present, not hours. |
| Shift edited after swap approved but before the shift occurs? | Swap request is auto-cancelled with notifications to all parties. Original `ShiftAssignment` is restored. Manager must re-review post-edit. |
| Location spanning a timezone boundary? | One authoritative IANA timezone per location, chosen at creation time. No split-timezone support. |
| Simultaneous assignment locking? | Re-validation inside `prisma.$transaction` rather than `SELECT FOR UPDATE` — avoids Prisma 7 driver adapter compatibility issues while preserving full correctness under race conditions. |

---

## Known Limitations

- Email notifications are plain text — no HTML templates.
- `prisma studio` is not available inside the production Docker container (the binary is stripped in the production build stage).
- The constraint engine evaluates availability at shift-level granularity. DST transitions that occur mid-shift are not handled (an extremely rare edge case affecting only one day per year near the transition boundary).
- Audit log `before` snapshots for assignments capture the assignment count, not a full diff of all fields.

---

## Docker

### Build Stages

The server Dockerfile uses three stages:

1. **development** — `npm ci`, generates Prisma client with a dummy `DATABASE_URL` (prisma.config.ts validation requires it at generate time)
2. **build** — copies `node_modules` + `src/generated`, runs `npm run build`, then `npm prune --production`
3. **production** — copies only `dist/`, `node_modules/`, `src/generated/`, `prisma/`, `package.json`, `prisma.config.ts`; runs as non-root `nestjs` user. CMD: `sh -c "npx prisma migrate deploy && node dist/src/main"`

Migrations are applied automatically on every container start before the server boots.

### Production Commands

```bash
# Build and start
docker compose up -d --build server

# View logs
docker logs -f shiftsync-server

# Apply migrations (auto-runs on start, but can be run manually)
docker exec shiftsync-server npx prisma migrate deploy

# Seed
docker exec shiftsync-server npx prisma db seed

# Open a shell
docker exec -it shiftsync-server sh
```
