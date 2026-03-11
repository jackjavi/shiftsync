<h1 align="center">ShiftSync — Server</h1>

<p align="center">
  Multi-location staff scheduling API for Coastal Eats restaurant group.<br/>
  Built with NestJS · Prisma 7 · PostgreSQL · Socket.IO · Docker
</p>

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Architecture Decisions](#architecture-decisions)
- [API Reference](#api-reference)
  - [Auth](#auth)
  - [Users](#users)
  - [Locations](#locations)
  - [Skills](#skills)
  - [Availability](#availability)
  - [Shifts](#shifts)
  - [Scheduling & Constraint Engine](#scheduling--constraint-engine)
  - [Swaps & Drop Requests](#swaps--drop-requests)
  - [Overtime](#overtime)
  - [Analytics & Fairness](#analytics--fairness)
  - [Notifications](#notifications)
  - [Audit Trail](#audit-trail)
- [Constraint Rules Reference](#constraint-rules-reference)
- [Evaluation Scenarios](#evaluation-scenarios)
- [Seed Data & Test Credentials](#seed-data--test-credentials)
- [Known Limitations](#known-limitations)
- [Ambiguity Decisions](#ambiguity-decisions)

---

## Tech Stack

| Layer      | Technology                            |
| ---------- | ------------------------------------- |
| Runtime    | Node.js 20                            |
| Framework  | NestJS 10                             |
| Language   | TypeScript 5                          |
| ORM        | Prisma 7 (driver adapter pattern)     |
| Database   | PostgreSQL 16                         |
| Auth       | JWT + Passport.js + bcrypt            |
| Validation | Zod                                   |
| Real-time  | Socket.IO                             |
| Scheduling | @nestjs/schedule (cron jobs)          |
| Events     | @nestjs/event-emitter (domain events) |
| Containers | Docker + Docker Compose               |

---

## Getting Started

### Prerequisites

- Node.js 20+
- Docker Desktop
- npm

### Installation

```bash
# 1. Clone the repository and navigate to server
cd apps/server

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.example .env
# Edit .env with your values

# 4. Start the database
sudo docker compose up db -d

# 5. Run migrations and seed
npx prisma migrate dev --name init
npx prisma db seed

# 6. Start the server
npm run start:dev
```

Server runs at: `http://localhost:3001/api`

### Scripts

```bash
npm run start:dev      # Development with hot-reload
npm run start:prod     # Production (runs compiled dist/)
npm run build          # Compile TypeScript
npm run test           # Unit tests
npm run test:e2e       # End-to-end tests
```

---

## Environment Variables

| Variable         | Required | Default                 | Description                       |
| ---------------- | -------- | ----------------------- | --------------------------------- |
| `DATABASE_URL`   | ✅       | —                       | PostgreSQL connection string      |
| `JWT_SECRET`     | ✅       | —                       | Secret key for signing JWT tokens |
| `JWT_EXPIRES_IN` | ❌       | `7d`                    | JWT expiry duration               |
| `PORT`           | ❌       | `3001`                  | Server port                       |
| `NODE_ENV`       | ❌       | `development`           | Environment mode                  |
| `CLIENT_URL`     | ❌       | `http://localhost:3000` | CORS allowed origin               |

---

## Database

### Prisma 7 — Driver Adapter Pattern

This project uses Prisma 7 which requires an explicit driver adapter instead of the built-in Rust engine. The `PrismaService` creates a `pg.Pool` and wraps it with `PrismaPg`:

```typescript
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
super({ adapter });
```

### Useful Commands

```bash
npx prisma migrate dev --name <name>   # Create and apply a migration
npx prisma migrate reset --force       # Drop all tables and re-seed
npx prisma db seed                     # Run seed only
npx prisma studio                      # Open visual DB browser at :5555
npx prisma generate                    # Regenerate Prisma Client after schema changes
npx prisma validate                    # Validate schema
```

---

## Architecture Decisions

### Timezone Strategy

All datetimes are stored as **UTC** in the database. Conversion happens only at the boundaries:

- When a manager creates a shift, the input datetime is converted from the location's timezone to UTC before storing.
- When displaying to the user, UTC is converted to the location's IANA timezone.
- Availability windows store `startTime`/`endTime` as `"HH:MM"` strings and are evaluated against the **location's timezone** at validation time — not the staff member's local time. This is the correct resolution of the Timezone Tangle scenario.

### Global JWT Guard

`JwtAuthGuard` is applied globally via `APP_GUARD`. Individual routes that need to be public (e.g. login, register) use the `@Public()` decorator to opt out.

### Constraint Engine

All scheduling constraints are validated in `SchedulingService.validateAssignment()` before any database write. Hard violations block the assignment entirely. Overtime violations (weekly >40h, 7th consecutive day) allow a `forceOverride: true` flag with a documented reason.

### Concurrent Assignment Protection

The `assign()` method uses a Prisma `$transaction` with a re-validation inside the transaction to prevent two managers from simultaneously assigning the same staff member. If a race is detected, a `assignment.conflict` event is emitted via Socket.IO to the losing manager's room in real-time.

### Audit Trail

All mutations (shift create/update/publish, assignments, swap approvals) are automatically logged via `@nestjs/event-emitter`. The `AuditService` listens for domain events and writes `before`/`after` JSON snapshots to the `audit_logs` table. No interceptor or decorator is needed on controllers.

---

## API Reference

All endpoints are prefixed with `/api`. All protected endpoints require:

```
Authorization: Bearer <access_token>
```

### Auth

#### `POST /api/auth/login`

Authenticate and receive a JWT token.

**Body:**

```json
{ "email": "string", "password": "string" }
```

**Response `200`:**

```json
{
  "access_token": "eyJhbGci...",
  "user": { "id": 1, "email": "admin@coastaleats.com", "role": "ADMIN" }
}
```

---

#### `GET /api/auth/me`

Get the currently authenticated user. 🔒 Requires auth.

**Response `200`:**

```json
{
  "data": {
    "id": 1,
    "email": "admin@coastaleats.com",
    "name": "Corporate Admin",
    "role": "ADMIN"
  }
}
```

---

### Users

#### `POST /api/users/register`

Self-register as a STAFF user. 🌐 Public.

**Body:**

```json
{ "email": "string", "password": "string (min 8 chars)", "name": "string" }
```

**Response `201`:** User object (no `passwordHash`).

---

#### `POST /api/users`

Create any role user. 🔒 ADMIN only.

**Body:**

```json
{
  "email": "string",
  "password": "string",
  "name": "string",
  "role": "ADMIN | MANAGER | STAFF",
  "desiredHoursPerWeek": 40
}
```

---

#### `GET /api/users`

List all users with skills and certifications. 🔒 ADMIN, MANAGER.

**Query params:** `page`, `limit`, `role`, `locationId`

---

#### `GET /api/users/me`

Get own full profile including skills and certifications. 🔒 Any authenticated user.

---

#### `GET /api/users/:id`

Get user by ID. 🔒 ADMIN, MANAGER.

---

#### `PATCH /api/users/me`

Update own profile (name, email, desiredHoursPerWeek). 🔒 Any authenticated user.

---

#### `PATCH /api/users/:id`

Update any user. 🔒 ADMIN only.

---

#### `POST /api/users/:id/skills`

Assign a skill to a user. 🔒 ADMIN, MANAGER.

**Body:**

```json
{ "skillId": 1 }
```

**Response `201`:**

```json
{ "data": { "userId": 1, "skillId": 1 } }
```

---

#### `DELETE /api/users/:id/skills/:skillId`

Remove a skill from a user. 🔒 ADMIN, MANAGER.

---

#### `POST /api/users/:id/certifications`

Certify a staff member at a location. 🔒 ADMIN, MANAGER.

**Body:**

```json
{ "locationId": 1 }
```

**Response `201`:**

```json
{
  "data": {
    "userId": 1,
    "locationId": 1,
    "certifiedAt": "2026-03-10T00:00:00.000Z",
    "location": { "id": 1, "name": "Coastal Eats - Santa Monica" }
  }
}
```

---

#### `DELETE /api/users/:id/certifications/:locationId`

Revoke a staff certification (soft delete — historical assignments preserved). 🔒 ADMIN, MANAGER.

---

### Locations

#### `POST /api/locations`

Create a location. 🔒 ADMIN only.

**Body:**

```json
{
  "name": "Coastal Eats - Santa Monica",
  "address": "123 Ocean Ave, Santa Monica, CA",
  "timezone": "America/Los_Angeles"
}
```

---

#### `GET /api/locations`

List locations. 🔒 Any authenticated user.

- ADMIN: all locations
- MANAGER: only their assigned locations
- STAFF: all active locations

---

#### `GET /api/locations/:id`

Get location detail including managers and certified staff. 🔒 Any authenticated user.

---

#### `PATCH /api/locations/:id`

Update location. 🔒 ADMIN only.

---

#### `POST /api/locations/:id/managers`

Assign a manager to a location. 🔒 ADMIN only.

**Body:**

```json
{ "userId": 2 }
```

---

#### `DELETE /api/locations/:id/managers/:userId`

Remove manager from location. 🔒 ADMIN only.

---

#### `GET /api/locations/:id/staff`

List all certified staff for a location. 🔒 ADMIN, MANAGER.

---

### Skills

#### `POST /api/skills`

Create a skill. 🔒 ADMIN only.

**Body:**

```json
{ "name": "bartender" }
```

---

#### `GET /api/skills`

List all skills. 🔒 Any authenticated user.

---

#### `DELETE /api/skills/:id`

Delete a skill. 🔒 ADMIN only.

---

### Availability

Staff set their own availability windows. These are evaluated in the **location's timezone** when checking if a staff member can be assigned to a shift.

#### `POST /api/availability`

Create an availability window. 🔒 Any authenticated user (sets own availability).

**Body — Recurring (weekly):**

```json
{
  "type": "RECURRING",
  "dayOfWeek": 1,
  "startTime": "09:00",
  "endTime": "17:00",
  "isAvailable": true,
  "note": "Available Mon 9-5"
}
```

**Body — One-off exception:**

```json
{
  "type": "ONE_OFF",
  "date": "2026-03-15",
  "startTime": "00:00",
  "endTime": "23:59",
  "isAvailable": false,
  "note": "Holiday — not available"
}
```

> `dayOfWeek`: 0 = Sunday, 1 = Monday … 6 = Saturday
> `isAvailable: false` creates a blocked/unavailable window that overrides recurring availability for that date.

---

#### `GET /api/availability/me`

Get own availability windows. 🔒 Any authenticated user.

---

#### `GET /api/availability/user/:userId`

Get any user's availability. 🔒 ADMIN, MANAGER.

---

#### `PATCH /api/availability/:id`

Update an availability window. 🔒 Owner only.

---

#### `DELETE /api/availability/:id`

Delete an availability window. 🔒 Owner only.

---

### Shifts

#### `POST /api/shifts`

Create a shift. 🔒 ADMIN, MANAGER.

> Managers can only create shifts for locations they manage.
> `isPremium` is auto-set to `true` for Friday/Saturday shifts starting at or after 17:00 in the location's timezone.

**Body:**

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

All datetimes must be ISO 8601 UTC strings.

---

#### `GET /api/shifts`

List shifts. 🔒 Any authenticated user.

- STAFF: published shifts only
- MANAGER: their location shifts (published + unpublished)
- ADMIN: all shifts

**Query params:**

| Param         | Type         | Description                      |
| ------------- | ------------ | -------------------------------- |
| `locationId`  | number       | Filter by location               |
| `skillId`     | number       | Filter by required skill         |
| `from`        | ISO datetime | Shifts starting after this time  |
| `to`          | ISO datetime | Shifts starting before this time |
| `isPublished` | boolean      | Filter by published status       |
| `page`        | number       | Page number                      |
| `limit`       | number       | Results per page (max 100)       |

---

#### `GET /api/shifts/:id`

Get shift detail including assignments and pending swap requests. 🔒 Any authenticated user.

---

#### `PATCH /api/shifts/:id`

Edit a shift. 🔒 ADMIN, MANAGER.

> Cannot edit a published shift within its `editCutoffHours` of start time (default 48h).
> Editing a shift automatically cancels any pending swap requests for that shift with notifications to all parties.

---

#### `DELETE /api/shifts/:id`

Delete a shift. 🔒 ADMIN, MANAGER.

---

#### `POST /api/shifts/:id/publish`

Publish a shift (makes it visible to staff). 🔒 ADMIN, MANAGER.

---

#### `POST /api/shifts/:id/unpublish`

Unpublish a shift. 🔒 ADMIN, MANAGER.

> Blocked within the edit cutoff window.

---

#### `POST /api/shifts/publish-week`

Publish all unpublished shifts for a location in a given week. 🔒 ADMIN, MANAGER.

**Body:**

```json
{
  "locationId": 1,
  "weekStart": "2026-03-16T00:00:00.000Z"
}
```

---

### Scheduling & Constraint Engine

The constraint engine is the core of the platform. Every assignment goes through `validateAssignment()` which checks all rules and returns structured violations with human-readable messages.

#### `GET /api/scheduling/validate`

Dry-run validation — checks all constraints without committing anything. 🔒 ADMIN, MANAGER.

**Query params:** `userId`, `shiftId`

**Response `200`:**

```json
{
  "data": {
    "isValid": false,
    "violations": [
      {
        "rule": "SKILL_MISMATCH",
        "message": "John does not have the required skill: bartender",
        "details": { "requiredSkill": "bartender", "userId": 3 }
      }
    ],
    "warnings": [
      {
        "rule": "WEEKLY_HOURS_EXCEEDED",
        "message": "John will work 37 hours this week (approaching 40h overtime threshold)",
        "details": { "projectedHours": 37, "warnThreshold": 35 }
      }
    ],
    "suggestions": [
      {
        "userId": 5,
        "userName": "Sarah Connor",
        "reason": "Has bartender skill, certified at this location, available"
      }
    ]
  }
}
```

**Constraint rules checked (in order):**

| Rule                    | Type                                            | Description                                      |
| ----------------------- | ----------------------------------------------- | ------------------------------------------------ |
| `SKILL_MISMATCH`        | Hard violation                                  | Staff lacks the required skill for the shift     |
| `CERTIFICATION_MISSING` | Hard violation                                  | Staff not certified at the shift's location      |
| `DOUBLE_BOOKING`        | Hard violation                                  | Staff already assigned to an overlapping shift   |
| `HEADCOUNT_FULL`        | Hard violation                                  | Shift already has full headcount filled          |
| `REST_PERIOD`           | Hard violation                                  | Less than 10h between this and an adjacent shift |
| `UNAVAILABLE`           | Hard violation                                  | Outside the staff member's availability windows  |
| `DAILY_HOURS_EXCEEDED`  | Warning (>8h) / Hard (>12h)                     | Daily hours limit                                |
| `WEEKLY_HOURS_EXCEEDED` | Warning (>35h) / Override required (>40h)       | Weekly hours limit                               |
| `CONSECUTIVE_DAYS`      | Warning (6th day) / Override required (7th day) | Consecutive days worked                          |

---

#### `POST /api/scheduling/assign`

Commit an assignment with full constraint enforcement. 🔒 ADMIN, MANAGER.

**Body:**

```json
{
  "userId": 1,
  "shiftId": 1,
  "forceOverride": false,
  "overrideReason": "Emergency coverage approved by district manager"
}
```

> Set `forceOverride: true` to bypass overtime and consecutive-day violations (still requires the reason to be logged).

**Response `201`:**

```json
{
  "data": {
    "assignment": {
      "id": 1,
      "shiftId": 1,
      "userId": 1,
      "status": "ASSIGNED",
      "assignedBy": 2
    },
    "warnings": []
  }
}
```

**Error `400` — constraint violation:**

```json
{
  "message": "Assignment violates scheduling constraints",
  "violations": [...],
  "warnings": [...],
  "suggestions": [...]
}
```

**Error `400` — override required:**

```json
{
  "message": "Assignment requires manager override",
  "violations": [...],
  "requiresOverride": true
}
```

---

#### `DELETE /api/scheduling/assign/:assignmentId`

Remove a staff assignment from a shift. 🔒 ADMIN, MANAGER.

---

#### `GET /api/scheduling/what-if`

Preview projected hours impact before committing an assignment. 🔒 ADMIN, MANAGER.

**Query params:** `userId`, `shiftId`

**Response `200`:**

```json
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

---

#### `GET /api/scheduling/suggestions/:shiftId`

Get a list of qualified staff who can cover a shift. 🔒 ADMIN, MANAGER.

Returns only staff who: have the required skill + location certification + no overlapping shifts + pass the rest period check + are within their availability windows.

**Response `200`:**

```json
{
  "data": [
    {
      "userId": 4,
      "userName": "Alex Kim",
      "reason": "Has bartender skill, certified at Santa Monica, available"
    }
  ]
}
```

---

## Constraint Rules Reference

### Hard Violations (block assignment entirely)

| Rule                      | Detail                                                                                                                                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Skill mismatch**        | The shift requires skill X. Staff does not have skill X.                                                                                                                                                                    |
| **Certification missing** | Staff is not certified at this location. Certification can be revoked — historical assignments remain valid.                                                                                                                |
| **Double booking**        | Staff already has an assigned shift whose time window overlaps with the new shift — even across different locations.                                                                                                        |
| **Rest period**           | Fewer than 10 hours between the end of one shift and start of the next for the same staff member.                                                                                                                           |
| **Unavailable**           | The shift falls outside the staff member's availability windows. One-off windows take precedence over recurring windows on the same date. If no availability is set, the staff member is considered available at all times. |
| **Daily hard block**      | Assigning this shift would result in the staff member working more than 12 hours in a single calendar day.                                                                                                                  |
| **Headcount full**        | The shift's headcount is already fully staffed.                                                                                                                                                                             |

### Warnings (returned but do not block)

| Rule                     | Threshold                        |
| ------------------------ | -------------------------------- |
| **Daily hours warning**  | Would exceed 8h in a day         |
| **Weekly hours warning** | Projected weekly hours > 35h     |
| **6th consecutive day**  | Staff would work 6 days in a row |

### Override Required (blocked unless `forceOverride: true`)

| Rule                    | Threshold                        |
| ----------------------- | -------------------------------- |
| **Weekly overtime**     | Projected weekly hours > 40h     |
| **7th consecutive day** | Staff would work 7 days in a row |

---

## Evaluation Scenarios

### 1. Sunday Night Chaos

A staff member calls out at 6pm for a 7pm shift.

```
GET /api/scheduling/suggestions/:shiftId
```

Returns all qualified, available, non-conflicted staff who can immediately cover the shift. The response includes the reason each person qualifies, making the decision instant.

### 2. The Overtime Trap

A manager builds a schedule without realising an employee hits 52 hours.

```
GET /api/scheduling/what-if?userId=X&shiftId=Y
```

Shows `projectedWeekHours: 52` before committing. If they try to assign anyway, the API returns `requiresOverride: true` with a clear explanation. The overtime dashboard at `GET /api/overtime/dashboard/:locationId` shows every staff member's projected hours for the week with overtime flags.

### 3. The Timezone Tangle

Staff member John is certified at a Pacific time location and an Eastern time location. He sets availability as "9am–5pm".

His availability is evaluated in the **location's timezone**:

- Pacific shift at 10am PT → 10am is within 9–5 ✅
- Eastern shift at 10am ET → 10am is within 9–5 ✅
- Eastern shift at 8am ET (= 5am PT) → 8am ET is within 9–5 ✅

The system does not project his window into his "home" timezone because no such concept exists in the data model. The window is always relative to where he is working.

### 4. The Simultaneous Assignment

Two managers try to assign the same bartender at the same time.

Both calls enter `SchedulingService.assign()` which wraps the final write in a `prisma.$transaction`. The second transaction detects the conflict via a re-validation inside the transaction, returns a 400, and emits an `assignment.conflict` Socket.IO event to the losing manager's room immediately.

### 5. The Fairness Complaint

An employee claims they never get Saturday night shifts.

```
GET /api/analytics/fairness/:locationId?from=2026-01-01T00:00:00Z&to=2026-03-31T23:59:59Z
```

Returns each staff member's premium shift count, deviation from the mean, and a `fairnessScore` (0–100). If the score is low, the response flags which staff are over/under-allocated on premium shifts.

### 6. The Regret Swap

Staff A requests a swap. Staff B accepts. Staff A changes their mind before the manager approves.

```
POST /api/swaps/:id/cancel   (as Staff A)
```

Status changes to `CANCELLED`. The original `ShiftAssignment` is untouched — Staff A remains on the shift. Staff B and the manager are notified. The manager never sees an incomplete swap to approve.

---

## Seed Data & Test Credentials

Run `npx prisma db seed` to populate the database with realistic test data covering all evaluation scenarios.

### Login Credentials

| Role           | Email                          | Password      | Notes                                                                  |
| -------------- | ------------------------------ | ------------- | ---------------------------------------------------------------------- |
| Admin          | `admin@coastaleats.com`        | `Admin1234!`  | Full platform access                                                   |
| Manager (West) | `manager.west@coastaleats.com` | `Manager123!` | Manages Santa Monica + Venice Beach (PT)                               |
| Manager (East) | `manager.east@coastaleats.com` | `Manager123!` | Manages Miami Beach + Fort Lauderdale (ET)                             |
| Staff          | `sarah@coastaleats.com`        | `Staff123!`   | Bartender, West Coast only, has pending DROP request                   |
| Staff          | `john@coastaleats.com`         | `Staff123!`   | Server + Host, **certified at both coasts** — Timezone Tangle scenario |
| Staff          | `emma@coastaleats.com`         | `Staff123!`   | Line cook, 4 shifts this week (32h) — Overtime Trap scenario           |
| Staff          | `lisa@coastaleats.com`         | `Staff123!`   | Server, East Coast, 0 premium shifts — Fairness Complaint scenario     |
| Staff          | `tom@coastaleats.com`          | `Staff123!`   | Line cook, 6 consecutive days assigned — Consecutive Day scenario      |

### Locations

| ID  | Name                           | Timezone              |
| --- | ------------------------------ | --------------------- |
| 1   | Coastal Eats - Santa Monica    | `America/Los_Angeles` |
| 2   | Coastal Eats - Venice Beach    | `America/Los_Angeles` |
| 3   | Coastal Eats - Miami Beach     | `America/New_York`    |
| 4   | Coastal Eats - Fort Lauderdale | `America/New_York`    |

### Pre-seeded Scenarios

- **Sunday Night Chaos** — Sarah is assigned to a Sunday 7pm bartender shift with an open DROP request. `GET /api/scheduling/suggestions/:shiftId` will return Alex Kim as an available replacement.
- **Overtime Trap** — Emma has 4×8h shifts (32h). Attempting to assign her a 10h shift will trigger the overtime hard block.
- **Timezone Tangle** — John is certified at locations in both PT and ET with 9–5 recurring availability.
- **Fairness Complaint** — Mike has 2 premium shifts; Lisa has 0. The fairness report shows a clear imbalance.
- **Regret Swap** — Carlos has a pending SWAP request with Alex for a Tuesday bartender shift. Cancel it as Carlos to test the regret flow.
- **Consecutive Days** — Tom is assigned 6 consecutive days. Adding a 7th will require a manager override.

---

## Known Limitations

- **Email notifications** are simulated (in-app only). No real email delivery is implemented. The architecture supports adding a mail provider (SendGrid, Resend, etc.) by extending `NotificationsService`.
- **The `on-duty` dashboard** updates via HTTP polling on the client. The Socket.IO `on-duty.update` event infrastructure is in place but the cron emitter is not yet wired to a scheduler interval.
- **Export of audit logs** returns JSON. CSV export is not yet implemented.
- **Prisma `$queryRaw` locking** for the simultaneous assignment scenario uses re-validation inside a transaction rather than a `SELECT FOR UPDATE` lock, which is slightly less strict but avoids driver adapter compatibility issues with Prisma 7.

---

## Ambiguity Decisions

The assessment document leaves several behaviours unspecified. The decisions made are:

| Ambiguity                                             | Decision                                                                                                                                                                                                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| De-certifying a staff member                          | Soft delete — `revokedAt` timestamp is set. Historical `ShiftAssignment` records remain intact and unmodified. Only future assignments are blocked.                                                                                                                |
| "Desired hours" vs availability windows               | Availability windows are **hard constraints** — a staff member cannot be assigned outside them regardless of desired hours. Desired hours is a **soft analytics target** used only in the fairness and distribution reports.                                       |
| Consecutive days — short vs long shifts               | Any shift of any duration counts as a worked day for consecutive day calculations. A 1-hour shift counts the same as an 11-hour shift.                                                                                                                             |
| Shift edited after swap approved but before it occurs | The assignment reverts to the original state. The swap request is cancelled with notifications to all parties. The manager must re-review any needed changes after editing the shift.                                                                              |
| Location spanning a timezone boundary                 | The system assigns one authoritative IANA timezone per location, set at creation time. If a restaurant physically straddles a timezone boundary, the manager chooses the timezone that the majority of operations occur in. No split-timezone support is provided. |
