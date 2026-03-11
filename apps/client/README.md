<h1 align="center">ShiftSync — Client</h1>

<p align="center">
  Multi-location staff scheduling frontend for Coastal Eats restaurant group.<br/>
  Built with Next.js 16 · TypeScript · Tailwind CSS · TanStack Query · Socket.IO
</p>

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Application Structure](#application-structure)
- [Pages](#pages)
- [State Management & Data Fetching](#state-management--data-fetching)
- [Real-Time Integration](#real-time-integration)
- [Design System](#design-system)
- [Component Architecture](#component-architecture)
- [Docker](#docker)

---

## Tech Stack

| Layer         | Technology                          |
| ------------- | ----------------------------------- |
| Framework     | Next.js 16 (App Router)             |
| Language      | TypeScript 5                        |
| Styling       | Tailwind CSS                        |
| Data Fetching | TanStack Query v5                   |
| Forms         | React Hook Form + Zod               |
| Calendar      | FullCalendar (week/month views)     |
| Charts        | Recharts                            |
| Real-time     | Socket.IO client                    |
| HTTP client   | Axios (JWT auto-attach interceptor) |

---

## Getting Started

### Prerequisites

- Node.js 20+
- ShiftSync server running at `http://localhost:3001` (or set `NEXT_PUBLIC_SERVER_URL`)

### Installation

```bash
cd apps/client

npm install

# Copy environment file
cp .env.local.example .env.local
# Edit .env.local — set NEXT_PUBLIC_SERVER_URL

npm run dev
```

Client runs at: `http://localhost:3000`

### Scripts

```bash
npm run dev        # Development with hot-reload (Turbopack)
npm run build      # Production build
npm run start      # Serve production build
npm run lint       # ESLint
```

---

## Environment Variables

| Variable                 | Required | Description                                                                                          |
| ------------------------ | -------- | ---------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SERVER_URL` | Yes      | Base URL of the NestJS server, e.g. `http://localhost:3001` or `https://shiftsync.boost-buddies.com` |

Create `.env.local` at `apps/client/.env.local`:

```env
NEXT_PUBLIC_SERVER_URL=http://localhost:3001/api
```

In production, the Docker build injects this as a build argument:

```yaml
args:
  NEXT_PUBLIC_SERVER_URL: https://shiftsync.boost-buddies.com
```

---

## Application Structure

```
apps/client/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx          # Login with quick-fill credentials panel
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Auth guard, notification badge polling
│   │   ├── schedule/page.tsx       # FullCalendar week/month schedule view
│   │   ├── shifts/
│   │   │   ├── page.tsx            # Shift list with filters
│   │   │   └── [id]/page.tsx       # Shift detail, assignments, audit trail
│   │   ├── staff/
│   │   │   ├── page.tsx            # Staff directory
│   │   │   └── [id]/page.tsx       # Staff profile — skills, certs, availability
│   │   ├── swaps/page.tsx          # Swap / drop request management
│   │   ├── overtime/page.tsx       # Weekly hours dashboard + Recharts
│   │   ├── analytics/page.tsx      # Fairness report, on-duty live panel
│   │   ├── notifications/page.tsx  # In-app notification inbox
│   │   └── audit/page.tsx          # Audit log with filters + CSV export
│   ├── globals.css                 # Design system CSS variables + animations
│   └── layout.tsx                  # Root layout — all providers
├── components/
│   ├── feedback/
│   │   ├── Toast.tsx               # Animated toast queue
│   │   ├── AlertBanner.tsx         # Inline dismissible alert
│   │   ├── ConstraintViolation.tsx # Structured violations/warnings/override button
│   │   └── EmptyState.tsx          # Empty state with presets
│   ├── layout/
│   │   ├── Sidebar.tsx             # Collapsible nav, role-based items, notification badge
│   │   └── Topbar.tsx              # Notification bell, user menu
│   ├── schedule/
│   │   ├── ScheduleCalendar.tsx    # FullCalendar wrapper (SSR-disabled)
│   │   └── AssignModal.tsx         # Validate + what-if + force-override flow
│   └── ui/index.tsx                # Button, Badge, Card, Input, Select, Modal, etc.
├── context/
│   ├── AuthContext.tsx             # User state, login/logout, role helpers
│   ├── ToastContext.tsx            # Toast queue with success/error/warning/info
│   └── RealtimeContext.tsx         # Socket.IO client, room management, on-duty state
├── lib/
│   ├── api.ts                      # Axios singleton, JWT interceptor, 401 handler
│   ├── queryClient.ts              # TanStack Query client config
│   └── utils.ts                    # cn(), formatInTz(), timeAgo(), and more
├── services/
│   └── index.ts                    # All API service functions (typed)
└── types/
    └── index.ts                    # All TypeScript interfaces
```

---

## Pages

### Schedule (`/schedule`)

FullCalendar week/month toggle with location filter. Shift events are colour-coded by status (published, unpublished, full). Clicking a shift opens the **AssignModal**, which runs a parallel `validate` + `what-if` call on staff selection, displays the `ConstraintViolationPanel`, and supports the force-override path for managers.

> FullCalendar must be loaded with `dynamic(..., { ssr: false })` — it uses browser APIs unavailable in SSR.

### Shifts (`/shifts`, `/shifts/:id`)

List view with location, skill, date, and published-status filters. The detail page shows the full shift, its current assignments, publish/unpublish actions, and a collapsible audit trail pulled from `GET /api/audit/shift/:shiftId`.

### Staff (`/staff`, `/staff/:id`)

Directory with role and location filters. The profile page lets admins and managers add/remove skills, grant/revoke location certifications, and manage the staff member's 7-day recurring availability grid.

### Swaps (`/swaps`)

Tabbed by status (Pending / Accepted / All) and type (Swap / Drop). Cards show context-aware actions — staff can cancel their own requests; managers can approve or reject accepted ones.

### Overtime (`/overtime`)

Week navigator with location selector. Four stat cards show total staff, those approaching 35h, those over 40h, and average hours. A Recharts bar chart renders per-staff hours with 35h (warning) and 40h (overtime) reference lines.

### Analytics (`/analytics`)

Fairness report with a RadialBar gauge per staff member, premium vs regular shift pie chart, and a per-staff hours bar chart. The **On-Duty Now** panel uses Socket.IO push as the primary data source and falls back to HTTP polling when the socket is disconnected.

### Notifications (`/notifications`)

In-app inbox with per-type emoji icons, per-notification mark-read, and mark-all-read. Unread count is polled every 30 seconds from the dashboard layout.

### Audit (`/audit`) — Admin only

Paginated log with entity-type dropdown and date-range filters. Each row can be expanded to show a before/after JSON diff. The **Export CSV** button downloads a filtered CSV (UTF-8 BOM for Excel compatibility) directly from `GET /api/audit/export` with JWT auth.

---

## State Management & Data Fetching

All server state is managed by **TanStack Query**. Query keys include all active filters so results update automatically when filters change. The smart retry config skips retrying 4xx responses.

```typescript
// Example: filtered audit log
useQuery({
  queryKey: ["audit", page, entityType, from, to],
  queryFn: () => auditService.list({ page, limit: 30, entityType, from, to }),
  enabled: isAdmin(),
});
```

All API calls go through the **Axios singleton** in `lib/api.ts`, which automatically attaches the JWT from `localStorage` and redirects to `/login` on 401.

---

## Real-Time Integration

`RealtimeContext` maintains a single Socket.IO connection to the server. On authentication it joins two rooms: `user:<id>` for personal notifications and `location:<id>` for location-scoped events.

Events handled:

| Event                 | Action                                                   |
| --------------------- | -------------------------------------------------------- |
| `notification`        | Adds toast + increments unread badge                     |
| `on-duty.update`      | Updates the live on-duty map in analytics                |
| `assignment.conflict` | Shows a warning toast (simultaneous assignment scenario) |
| `swap.requested`      | Notifies manager of a new swap                           |
| `swap.approved`       | Notifies staff their swap was approved                   |
| `schedule.published`  | Notifies staff a schedule is available                   |
| `assignment.created`  | Notifies staff they've been assigned to a shift          |
| `shift.updated`       | Alerts staff to a shift change                           |

The on-duty panel in Analytics uses the socket as primary and HTTP polling (`GET /api/analytics/on-duty-now`) as fallback, automatically switching when socket connectivity changes.

---

## Design System

The design aesthetic is **"Operational Luxury"** — a dark-first interface with deep navy/slate tones, an electric teal accent, amber warnings, and crimson violations.

Key CSS variables (defined in `globals.css`):

| Variable    | Value               | Usage                               |
| ----------- | ------------------- | ----------------------------------- |
| `--accent`  | `hsl(187 100% 42%)` | Electric teal — CTAs, active states |
| `--warning` | `hsl(38 95% 52%)`   | Amber — overtime warnings           |
| `--danger`  | `hsl(0 72% 54%)`    | Crimson — constraint violations     |
| `--bg`      | `hsl(215 28% 7%)`   | Deep navy background                |
| `--surface` | `hsl(215 25% 11%)`  | Card backgrounds                    |

Typography: **Nunito** for body text, **Playfair Display** for display headings.

Animations: `animate-fade-in`, `animate-slide-up`, `animate-pulse-slow`, `shimmer` — all defined in `globals.css`.

---

## Component Architecture

### `ConstraintViolation`

Renders structured violations (hard blocks), warnings, and suggestions from the scheduling engine. Includes a **Force Override** button that passes `forceOverride: true` to the assign endpoint when managers need to bypass overtime/consecutive-day limits.

### `AssignModal`

Runs two API calls in parallel on staff selection: `GET /api/scheduling/validate` and `GET /api/scheduling/what-if`. Renders the `WhatIfPanel` (showing projected hours impact) and the `ConstraintViolationPanel` side by side before the manager commits.

### `ScheduleCalendar`

FullCalendar `dayGridMonth` / `timeGridWeek` toggle. Events are hydrated from TanStack Query and colour-coded. Must be imported with `dynamic(..., { ssr: false })` in the parent page.

---

## Docker

### Multi-stage Dockerfile

The client uses a three-stage build:

1. **deps** — installs `node_modules` from `package-lock.json`
2. **builder** — injects `NEXT_PUBLIC_SERVER_URL` as a build arg and runs `next build` with standalone output
3. **runner** — copies only the standalone output, static assets, and public folder; runs as non-root `nextjs` user

```dockerfile
# Build arg injected by docker-compose at build time
ARG NEXT_PUBLIC_SERVER_URL=http://localhost:3001
ENV NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL
```

### next.config requirement

The standalone output requires `output: 'standalone'` in `next.config.js`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
};
module.exports = nextConfig;
```

### Running in production

```bash
# From the repo root
docker compose up -d --build client

# Rebuild after code changes
docker compose up -d --build client
```
