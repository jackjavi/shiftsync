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

| Layer         | Technology                            |
| ------------- | ------------------------------------- |
| Framework     | Next.js 16 (App Router)               |
| Language      | TypeScript 5                          |
| Styling       | Tailwind CSS                          |
| Data Fetching | TanStack Query v5                     |
| Forms         | React Hook Form + Zod                 |
| Calendar      | FullCalendar (week/month views)       |
| Charts        | Recharts                              |
| Real-time     | Socket.IO client                      |
| HTTP client   | Axios (JWT auto-attach interceptor)   |
| Date handling | date-fns + date-fns-tz                |

---

## Getting Started

### Prerequisites

- Node.js 22+
- ShiftSync server running at `http://localhost:3001` (or set `NEXT_PUBLIC_SERVER_URL`)

### Installation

```bash
cd apps/client
npm install
cp .env.local.example .env.local   # set NEXT_PUBLIC_SERVER_URL
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

| Variable                   | Required | Description |
| -------------------------- | -------- | ----------- |
| `NEXT_PUBLIC_SERVER_URL`   | Yes      | Full base URL of the NestJS API **including** the `/api` path segment, e.g. `http://localhost:3001/api` or `https://shiftsync.boost-buddies.com/api` |

Create `apps/client/.env.local`:

```env
NEXT_PUBLIC_SERVER_URL=http://localhost:3001/api
```

> **Important:** The Socket.IO connection strips the `/api` suffix automatically — the realtime context connects to the base server URL, not the API path.

In production, Docker injects this as a build argument:
```yaml
build:
  args:
    NEXT_PUBLIC_SERVER_URL: https://shiftsync.boost-buddies.com/api
```

---

## Application Structure

```
apps/client/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx              # Login page with quick-fill credentials panel
│   ├── (dashboard)/
│   │   ├── layout.tsx                  # Auth guard, sidebar, topbar, notification polling
│   │   ├── page.tsx                    # Dashboard home / redirect
│   │   ├── schedule/page.tsx           # FullCalendar week/month schedule view
│   │   ├── shifts/
│   │   │   ├── page.tsx                # Shift list with filters
│   │   │   └── [id]/page.tsx           # Shift detail, assignments, audit trail
│   │   ├── staff/
│   │   │   ├── page.tsx                # Staff directory (admin/manager)
│   │   │   ├── me/page.tsx             # Own profile shortcut
│   │   │   └── [id]/page.tsx           # Profile — skills, certs, availability grid
│   │   ├── swaps/page.tsx              # Swap/drop request management
│   │   ├── overtime/page.tsx           # Weekly hours dashboard with Recharts
│   │   ├── analytics/page.tsx          # Fairness report + live on-duty panel
│   │   ├── notifications/page.tsx      # In-app notification inbox
│   │   ├── audit/page.tsx              # Audit log with filters + CSV export (admin)
│   │   └── settings/page.tsx           # User preferences: name, desired hours, email notifs
│   ├── globals.css                     # Design tokens (CSS variables) + animations
│   └── layout.tsx                      # Root layout — QueryClientProvider, all contexts
├── components/
│   ├── feedback/
│   │   ├── Toast.tsx                   # Animated toast queue (success/error/warning/info)
│   │   ├── AlertBanner.tsx             # Inline dismissible alert
│   │   ├── ConstraintViolation.tsx     # Structured violations / warnings / override button
│   │   └── EmptyState.tsx              # Empty state with icon presets
│   ├── layout/
│   │   ├── Sidebar.tsx                 # Collapsible nav, role-based items, unread badge
│   │   └── Topbar.tsx                  # Notification bell, user menu, breadcrumb
│   ├── schedule/
│   │   ├── ScheduleCalendar.tsx        # FullCalendar wrapper (SSR-disabled, role-aware)
│   │   └── AssignModal.tsx             # Validate + what-if + force-override flow
│   └── ui/index.tsx                    # Button, Badge, Card, Input, Select, Modal, Spinner
├── context/
│   ├── AuthContext.tsx                 # User state, login/logout, role helpers, /auth/me refresh
│   ├── ToastContext.tsx                # Toast queue with deduplication
│   └── RealtimeContext.tsx             # Socket.IO client, room joins, on-duty state
├── lib/
│   ├── api.ts                          # Axios singleton, JWT interceptor, 401 redirect
│   ├── queryClient.ts                  # TanStack Query client (no retry on 4xx)
│   └── utils.ts                        # cn(), formatInTz(), timeAgo(), shiftDurationHours()
├── services/
│   └── index.ts                        # All API service functions (typed wrappers over Axios)
└── types/
    └── index.ts                        # TypeScript interfaces matching server models
```

---

## Pages

### Login (`/login`)

Standard email/password form. A collapsible **Quick-Fill** panel lists all seeded credentials so evaluators can log in as any role with one click. JWT is stored in `localStorage` and attached to every subsequent request by the Axios interceptor.

---

### Schedule (`/schedule`)

FullCalendar `timeGridWeek` / `dayGridMonth` toggle with a location filter dropdown. Shift events are colour-coded:

| Colour | Meaning |
| --- | --- |
| Teal (accent) | Published, slots available |
| Amber | Unpublished draft |
| Green | Fully staffed |
| Premium badge | Friday/Saturday evening premium shift |

Clicking a shift opens the **AssignModal** (managers/admins) or a read-only detail popover (staff).

**Role-aware data fetching:**
- STAFF: calls `GET /api/shifts?isPublished=true` — sees only published shifts they're assigned to via `shiftsService.myShifts()`
- MANAGER/ADMIN: sees all shifts including unpublished drafts, filtered by selected location

> FullCalendar uses browser-only APIs — the component is loaded with `dynamic(..., { ssr: false })` in the page to prevent SSR errors.

---

### Shifts (`/shifts`, `/shifts/:id`)

List view with filters for location, skill, date range, and published status. Pagination is handled via TanStack Query with `keepPreviousData`.

The **detail page** (`/shifts/:id`) shows:
- Shift metadata (location, skill, time, headcount)
- Current assignments with unassign buttons (manager/admin)
- Pending swap requests for this shift
- Publish / Unpublish action buttons with cutoff-window enforcement
- Collapsible **Audit Trail** pulled from `GET /api/audit/shift/:id`

---

### Staff (`/staff`, `/staff/me`, `/staff/:id`)

Directory with role and location filters, accessible to admins and managers. The **profile page** (`/staff/:id`) has three sections:

- **Skills** — add/remove skills (manager/admin). Current skills shown as dismissible badges.
- **Certifications** — grant/revoke location certifications. Shows `certifiedAt` and `revokedAt` if applicable.
- **Availability** — 7-day recurring grid. Each day can be set available/unavailable with a time range. One-off exceptions can be added for specific dates.

Staff accessing `/staff/me` or their own `/staff/:id` see their own profile using `GET /api/users/me` (no elevated permissions required).

---

### Swaps (`/swaps`)

Tabbed interface by status (Pending / Accepted / All) and type (Swap / Drop). Cards display the shift context, requester/target names, notes, and expiry time.

**Context-aware actions per card:**
- **Staff A (requester):** Cancel button while PENDING or ACCEPTED
- **Staff B (target of SWAP):** Accept / Reject buttons while PENDING
- **Any qualified staff (DROP):** Pick Up button
- **Manager/Admin:** Approve / Reject buttons once ACCEPTED; also see all requests across their locations

---

### Overtime (`/overtime`)

Week navigator (← / →) with location selector. Four stat cards:

| Card | Metric |
| --- | --- |
| Total Staff Scheduled | Count for the selected week |
| Approaching Overtime | Staff between 35h and 40h |
| Overtime | Staff over 40h |
| Average Hours | Mean across all scheduled staff |

A Recharts **BarChart** renders per-staff projected hours with reference lines at 35h (warning — amber) and 40h (violation — crimson). Hovering a bar shows the staff member's name, hours, and whether an override is required.

---

### Analytics (`/analytics`)

Two panels:

**Fairness Report**
- RadialBar gauge per staff member showing their share of premium shifts vs the location mean
- Premium vs regular shift pie chart
- Per-staff hours bar chart over the selected date range
- Deviation badges: 🔴 Under-allocated / 🟢 Over-allocated / ✅ Fair

**On-Duty Now**
- Live panel showing who is currently clocked in at each location
- Updated every 10 seconds via Socket.IO `on-duty.update` push (primary)
- Falls back to HTTP polling `GET /api/analytics/on-duty` when socket is disconnected
- The panel automatically switches between sources and shows a ⚡ / 📡 indicator

---

### Notifications (`/notifications`)

In-app inbox with per-type emoji icons. Supports:
- Per-notification mark-read (`PATCH /api/notifications/:id/read`)
- Mark-all-read (`PATCH /api/notifications/read-all`)
- Unread count badge in sidebar and topbar bell icon, polled every 5 seconds from the dashboard layout

---

### Audit (`/audit`) — Admin only

Paginated log of all platform mutations. Filters:
- Entity type (Shift, ShiftAssignment, SwapRequest, User, Schedule, OvertimeOverride)
- Date range

Each row expands to show a formatted before/after JSON diff. The **Export CSV** button calls `GET /api/audit/export` with the current filters — the server streams a UTF-8 BOM CSV file directly (Excel-compatible).

---

### Settings (`/settings`)

Profile preferences page for all authenticated users:
- Display name
- Desired hours per week (used in fairness analytics)
- Email notifications toggle (opt-in to receive emails in addition to in-app notifications)

Changes are saved via `PATCH /api/users/me` and the auth context refreshes immediately via `/auth/me`.

---

## State Management & Data Fetching

All server state is managed by **TanStack Query v5**. Key patterns:

```typescript
// Query keys include all active filters — results auto-update when filters change
useQuery({
  queryKey: ['shifts', { locationId, skillId, from, to, isPublished, page }],
  queryFn: () => shiftsService.list({ locationId, skillId, from, to, isPublished, page }),
});

// Mutations invalidate relevant queries on success
useMutation({
  mutationFn: (body) => schedulingService.assign(body),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['shifts'] });
    queryClient.invalidateQueries({ queryKey: ['overtime'] });
  },
});
```

**Smart retry config** in `queryClient.ts` — 4xx responses are not retried (constraint violations, auth errors). Only network errors and 5xx responses retry with backoff.

All API calls go through the **Axios singleton** in `lib/api.ts`:
- Reads JWT from `localStorage` and attaches it as `Authorization: Bearer <token>` on every request
- On 401, clears the token and redirects to `/login`
- On 403, shows a toast error without redirecting

---

## Real-Time Integration

`RealtimeContext` maintains a single Socket.IO connection. On authentication, the client emits two join events:

```typescript
socket.emit('join:user', { userId: user.id });        // personal notifications
socket.emit('join:location', { locationId });          // location-scoped updates
// Admins also: socket.emit('join:admin')
```

The socket URL strips `/api` from `NEXT_PUBLIC_SERVER_URL` — Socket.IO connects to the base server URL, not the REST API prefix.

### Events Handled

| Server event | Client action |
| --- | --- |
| `notification` | Adds toast + increments unread badge counter |
| `on-duty.update` | Updates the live on-duty map in Analytics |
| `assignment.conflict` | Shows warning toast: "Another manager just assigned this staff member" |
| `swap.requested` | Notifies Staff B of incoming swap request |
| `swap.new_drop` | Notifies managers of a new drop request needing coverage |
| `swap.approved` | Notifies both staff parties of approval |
| `schedule.published` | Notifies location staff a new schedule is available |
| `assignment.created` | Notifies the assigned staff member and refreshes location view |
| `shift.updated` | Triggers a query refetch for the affected shift |

### Connection Resilience

- If the socket is disconnected, the `on-duty` panel falls back to HTTP polling every 10 seconds
- The notification badge falls back to 5-second HTTP polling as a backstop
- When the socket reconnects, real-time resumes automatically

---

## Design System

The design aesthetic is **"Operational Luxury"** — a dark-first interface with deep navy/slate backgrounds, an electric teal accent, amber warnings, and crimson hard violations. The visual language deliberately mirrors real-world operations dashboards (airline ops, hospital staffing) rather than a typical SaaS tool.

### CSS Variables (defined in `globals.css`)

| Variable        | Value                 | Usage |
| --------------- | --------------------- | ----- |
| `--accent`      | `hsl(187 100% 42%)`   | Electric teal — CTAs, active nav items, links |
| `--warning`     | `hsl(38 95% 52%)`     | Amber — overtime warnings, 35h+ alerts |
| `--danger`      | `hsl(0 72% 54%)`      | Crimson — hard constraint violations, 40h+ blocks |
| `--success`     | `hsl(142 71% 45%)`    | Green — fully staffed, approved states |
| `--bg`          | `hsl(215 28% 7%)`     | Deep navy — page background |
| `--surface`     | `hsl(215 25% 11%)`    | Slightly lighter navy — card backgrounds |
| `--surface-2`   | `hsl(215 22% 16%)`    | Hover states, borders |
| `--text-primary`| `hsl(210 40% 96%)`    | Primary text |
| `--text-muted`  | `hsl(215 16% 57%)`    | Secondary / label text |

### Typography

- **Nunito** — body text, labels, UI copy
- **Playfair Display** — display headings, page titles (applied via `font-display` Tailwind class)

### Animations

All defined in `globals.css` as standard `@keyframes`:

| Class | Effect |
| --- | --- |
| `animate-fade-in` | Opacity 0→1, used on page/card mounts |
| `animate-slide-up` | Translate Y + fade, used on modals |
| `animate-pulse-slow` | Slow opacity pulse for live indicators |
| `shimmer` | Skeleton loading background sweep |

---

## Component Architecture

### `ConstraintViolation`

Renders the structured response from `GET /api/scheduling/validate`. Three distinct visual sections:

- **Violations** (red) — hard blocks with the specific rule name and human-readable reason
- **Warnings** (amber) — soft alerts with projected impact
- **Suggestions** (teal) — alternative staff who can cover, with one-click assign

Includes a **Force Override** button that appears only when `requiresOverride: true`. Clicking it reveals a text input for the override reason, then passes `{ forceOverride: true, overrideReason: "..." }` to `POST /api/scheduling/assign`.

### `AssignModal`

Triggered by clicking a shift event in the calendar or an assign button in the shift detail page. On staff member selection it fires two parallel API calls:

1. `GET /api/scheduling/validate?userId=X&shiftId=Y` — constraint check
2. `GET /api/scheduling/what-if?userId=X&shiftId=Y` — hours projection

Both results render side-by-side before the manager confirms. The confirm button is disabled while either call is pending, and disabled (with explanation) if hard violations exist and `forceOverride` is not engaged.

### `ScheduleCalendar`

Wraps FullCalendar's `timeGridWeek` and `dayGridMonth` views. Key implementation notes:

- Must be loaded with `dynamic(..., { ssr: false })` — FullCalendar accesses `window` and `document` directly
- Events are fetched via TanStack Query and mapped to FullCalendar's event object format
- Event colour is computed from shift status (published/draft/full/premium)
- Staff users see `myShifts()` (their own assignments only). Managers/admins see all shifts for the selected location.

### `ui/index.tsx`

Shared primitive components: `Button` (with variant + size + loading state), `Badge` (with colour variants), `Card`, `Input`, `Select`, `Modal` (portal-based with focus trap), `Spinner`, `Skeleton`.

All primitives accept standard HTML props via `...rest` spread. Styling is done purely with Tailwind utility classes referencing the CSS variable tokens above.

---

## Docker

### Multi-stage Dockerfile

Three stages:

1. **deps** — `npm ci` from `package-lock.json`
2. **builder** — injects `NEXT_PUBLIC_SERVER_URL` as a build argument, runs `next build` with standalone output
3. **runner** — copies only the standalone output + `public/` + `.next/static/`. Runs as non-root `nextjs` user on port 3000.

```dockerfile
ARG NEXT_PUBLIC_SERVER_URL=http://localhost:3001/api
ENV NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL
RUN npm run build
```

The standalone output requires `output: 'standalone'` in `next.config.js`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = { output: 'standalone' };
module.exports = nextConfig;
```

### Production Commands

```bash
# Build and start
docker compose up -d --build client

# Rebuild after npm package changes (bypasses layer cache)
docker compose build --no-cache client && docker compose up -d client

# View logs
docker logs -f shiftsync-client
```

> **Note:** If you install npm packages directly on the production server (bypassing git), always rebuild with `--no-cache` — Docker caches the `npm ci` layer and won't pick up new packages otherwise.
