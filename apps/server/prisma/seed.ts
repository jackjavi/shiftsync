import {
  PrismaClient,
  // UserRole,
  // SwapType,
  // SwapStatus,
  // AssignmentStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from 'prisma/config';

// Inline enum values — avoids import path issues with custom prisma output
const UserRole = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  STAFF: 'STAFF',
} as const;
const SwapType = { SWAP: 'SWAP', DROP: 'DROP' } as const;
const SwapStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  APPROVED: 'APPROVED',
} as const;
const OvertimeOverrideReason = {
  EMERGENCY_COVERAGE: 'EMERGENCY_COVERAGE',
  BUSINESS_NECESSITY: 'BUSINESS_NECESSITY',
  STAFF_REQUEST: 'STAFF_REQUEST',
  OTHER: 'OTHER',
} as const;
const NotificationType = {
  SHIFT_ASSIGNED: 'SHIFT_ASSIGNED',
  SHIFT_CHANGED: 'SHIFT_CHANGED',
  SHIFT_UNASSIGNED: 'SHIFT_UNASSIGNED',
  SWAP_REQUESTED: 'SWAP_REQUESTED',
  SWAP_ACCEPTED: 'SWAP_ACCEPTED',
  SWAP_REJECTED: 'SWAP_REJECTED',
  SWAP_CANCELLED: 'SWAP_CANCELLED',
  SWAP_APPROVED: 'SWAP_APPROVED',
  SWAP_EXPIRED: 'SWAP_EXPIRED',
  DROP_AVAILABLE: 'DROP_AVAILABLE',
  DROP_EXPIRING: 'DROP_EXPIRING',
  SCHEDULE_PUBLISHED: 'SCHEDULE_PUBLISHED',
  SCHEDULE_UNPUBLISHED: 'SCHEDULE_UNPUBLISHED',
  OVERTIME_WARNING: 'OVERTIME_WARNING',
  CONSECUTIVE_DAY_WARNING: 'CONSECUTIVE_DAY_WARNING',
  AVAILABILITY_CHANGED: 'AVAILABILITY_CHANGED',
} as const;

const adapter = new PrismaPg({
  connectionString: env('DATABASE_URL')!,
});
const prisma = new PrismaClient({ adapter });
const HASH_ROUNDS = 10;

async function hash(pw: string) {
  return bcrypt.hash(pw, HASH_ROUNDS);
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function getMonday(reference: Date = new Date()): Date {
  const d = new Date(reference);
  const dow = d.getUTCDay(); // 0=Sun … 6=Sat
  const back = dow === 0 ? 6 : dow - 1;
  d.setUTCDate(d.getUTCDate() - back);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// offsetDays from monday of current week, hoursUTC = UTC hour
function w(
  monday: Date,
  offsetDays: number,
  hoursUTC: number,
  minsUTC = 0,
): Date {
  const d = new Date(monday);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  d.setUTCHours(hoursUTC, minsUTC, 0, 0);
  return d;
}

// Last week helper
function lw(lastMonday: Date, offsetDays: number, hoursUTC: number): Date {
  return w(lastMonday, offsetDays, hoursUTC);
}

async function main() {
  console.log('🌱  Seeding ShiftSync — Coastal Eats...\n');

  // ═══════════════════════════════════════════════════════════════════════════
  // SKILLS
  // ═══════════════════════════════════════════════════════════════════════════
  const [bartender, lineCook, server, host] = await Promise.all([
    prisma.skill.upsert({
      where: { name: 'bartender' },
      update: {},
      create: { name: 'bartender' },
    }),
    prisma.skill.upsert({
      where: { name: 'line_cook' },
      update: {},
      create: { name: 'line_cook' },
    }),
    prisma.skill.upsert({
      where: { name: 'server' },
      update: {},
      create: { name: 'server' },
    }),
    prisma.skill.upsert({
      where: { name: 'host' },
      update: {},
      create: { name: 'host' },
    }),
  ]);
  console.log('✓  Skills');

  // ═══════════════════════════════════════════════════════════════════════════
  // LOCATIONS  — 2 PT (CA) + 2 ET (FL)
  // ═══════════════════════════════════════════════════════════════════════════
  const loc1 = await prisma.location.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'Coastal Eats - Santa Monica',
      address: '123 Ocean Ave, Santa Monica, CA 90401',
      timezone: 'America/Los_Angeles',
    },
  });
  const loc2 = await prisma.location.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      name: 'Coastal Eats - Venice Beach',
      address: '456 Boardwalk, Venice, CA 90291',
      timezone: 'America/Los_Angeles',
    },
  });
  const loc3 = await prisma.location.upsert({
    where: { id: 3 },
    update: {},
    create: {
      id: 3,
      name: 'Coastal Eats - Miami Beach',
      address: '789 Collins Ave, Miami Beach, FL 33139',
      timezone: 'America/New_York',
    },
  });
  const loc4 = await prisma.location.upsert({
    where: { id: 4 },
    update: {},
    create: {
      id: 4,
      name: 'Coastal Eats - Fort Lauderdale',
      address: '321 Las Olas Blvd, Fort Lauderdale, FL 33301',
      timezone: 'America/New_York',
    },
  });
  console.log('✓  Locations');

  // ═══════════════════════════════════════════════════════════════════════════
  // USERS
  // ═══════════════════════════════════════════════════════════════════════════
  const admin = await prisma.user.upsert({
    where: { email: 'jackjavi254@gmail.com' },
    update: {},
    create: {
      email: 'jackjavi254@gmail.com',
      passwordHash: await hash('Admin1234!'),
      name: 'Jack Javi (Admin)',
      role: UserRole.ADMIN,
    },
  });

  const mgrWest = await prisma.user.upsert({
    where: { email: 'jackmtembete@gmail.com' },
    update: {},
    create: {
      email: 'jackmtembete@gmail.com',
      passwordHash: await hash('Manager123!'),
      name: 'Jack Mtembete',
      role: UserRole.MANAGER,
    },
  });

  const mgrEast = await prisma.user.upsert({
    where: { email: 'devjack650@gmail.com' },
    update: {},
    create: {
      email: 'devjack650@gmail.com',
      passwordHash: await hash('Manager123!'),
      name: 'Dev Jack',
      role: UserRole.MANAGER,
    },
  });

  // ── Staff ──────────────────────────────────────────────────────────────────
  // Jackton — bartender, West Coast, Mon-Fri only → Sunday Night Chaos
  const jackton = await prisma.user.upsert({
    where: { email: 'jacktonmtembete@gmail.com' },
    update: {},
    create: {
      email: 'jacktonmtembete@gmail.com',
      passwordHash: await hash('Staff123!'),
      name: 'Jackton Mtembete',
      role: UserRole.STAFF,
      desiredHoursPerWeek: 30,
    },
  });

  // Elite — server+host, all 4 locations → Timezone Tangle
  const elite = await prisma.user.upsert({
    where: { email: 'elitebrainsconsulting@gmail.com' },
    update: {},
    create: {
      email: 'elitebrainsconsulting@gmail.com',
      passwordHash: await hash('Staff123!'),
      name: 'Elite Brain',
      role: UserRole.STAFF,
      desiredHoursPerWeek: 40,
    },
  });

  // Javi — line cook, West Coast → Overtime Trap (already at 32h, adding 5th shift triggers warning)
  const javi = await prisma.user.upsert({
    where: { email: 'javiarts@gmail.com' },
    update: {},
    create: {
      email: 'javiarts@gmail.com',
      passwordHash: await hash('Staff123!'),
      name: 'Javi Arts',
      role: UserRole.STAFF,
      desiredHoursPerWeek: 35,
    },
  });

  // Oddie — bartender+server, West Coast → Regret Swap (initiator who wants to cancel)
  const oddie = await prisma.user.upsert({
    where: { email: 'oddtwotips@gmail.com' },
    update: {},
    create: {
      email: 'oddtwotips@gmail.com',
      passwordHash: await hash('Staff123!'),
      name: 'Oddie Tips',
      role: UserRole.STAFF,
      desiredHoursPerWeek: 25,
    },
  });

  // Rahab — server, East Coast → Fairness Complaint (0 premium shifts this week)
  const rahab = await prisma.user.upsert({
    where: { email: 'rahabmwaura96@gmail.com' },
    update: {},
    create: {
      email: 'rahabmwaura96@gmail.com',
      passwordHash: await hash('Staff123!'),
      name: 'Rahab Mwaura',
      role: UserRole.STAFF,
      desiredHoursPerWeek: 32,
    },
  });

  // Muzilly — host+server, East Coast → hoarding premium shifts (Fairness foil)
  const muzilly = await prisma.user.upsert({
    where: { email: 'muzillyamani@gmail.com' },
    update: {},
    create: {
      email: 'muzillyamani@gmail.com',
      passwordHash: await hash('Staff123!'),
      name: 'Muzilly Amani',
      role: UserRole.STAFF,
      desiredHoursPerWeek: 20,
    },
  });

  // Alex — bartender, all locations → Simultaneous Assignment target + swap target
  const alex = await prisma.user.upsert({
    where: { email: 'alex@coastaleats.com' },
    update: {},
    create: {
      email: 'alex@coastaleats.com',
      passwordHash: await hash('Staff123!'),
      name: 'Alex Kim',
      role: UserRole.STAFF,
      desiredHoursPerWeek: 40,
    },
  });

  // Tom — line cook, West Coast → Consecutive Days (already 5 days, 6th triggers warning)
  const tom = await prisma.user.upsert({
    where: { email: 'tom@coastaleats.com' },
    update: {},
    create: {
      email: 'tom@coastaleats.com',
      passwordHash: await hash('Staff123!'),
      name: 'Tom Baker',
      role: UserRole.STAFF,
      desiredHoursPerWeek: 40,
    },
  });

  // Sara — server, West Coast → under-scheduled (only 8h desired 40, to show analytics gap)
  const sara = await prisma.user.upsert({
    where: { email: 'sara@coastaleats.com' },
    update: {},
    create: {
      email: 'sara@coastaleats.com',
      passwordHash: await hash('Staff123!'),
      name: 'Sara Nguyen',
      role: UserRole.STAFF,
      desiredHoursPerWeek: 40,
    },
  });

  // Marcus — bartender+server, East Coast → coverage candidate for Sunday Chaos
  const marcus = await prisma.user.upsert({
    where: { email: 'marcus@coastaleats.com' },
    update: {},
    create: {
      email: 'marcus@coastaleats.com',
      passwordHash: await hash('Staff123!'),
      name: 'Marcus Webb',
      role: UserRole.STAFF,
      desiredHoursPerWeek: 35,
    },
  });

  console.log('✓  Users (3 managers, 10 staff)');

  // ═══════════════════════════════════════════════════════════════════════════
  // MANAGER → LOCATION ASSIGNMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  await prisma.locationManager.createMany({
    data: [
      { userId: mgrWest.id, locationId: loc1.id },
      { userId: mgrWest.id, locationId: loc2.id },
      { userId: mgrEast.id, locationId: loc3.id },
      { userId: mgrEast.id, locationId: loc4.id },
    ],
    skipDuplicates: true,
  });
  console.log('✓  Manager → location assignments');

  // ═══════════════════════════════════════════════════════════════════════════
  // STAFF CERTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  await prisma.staffCertification.createMany({
    data: [
      // Jackton: West only
      { userId: jackton.id, locationId: loc1.id },
      { userId: jackton.id, locationId: loc2.id },
      // Elite: All 4 (Timezone Tangle)
      { userId: elite.id, locationId: loc1.id },
      { userId: elite.id, locationId: loc2.id },
      { userId: elite.id, locationId: loc3.id },
      { userId: elite.id, locationId: loc4.id },
      // Javi: West only
      { userId: javi.id, locationId: loc1.id },
      { userId: javi.id, locationId: loc2.id },
      // Oddie: West only
      { userId: oddie.id, locationId: loc1.id },
      { userId: oddie.id, locationId: loc2.id },
      // Rahab: East only
      { userId: rahab.id, locationId: loc3.id },
      { userId: rahab.id, locationId: loc4.id },
      // Muzilly: East only
      { userId: muzilly.id, locationId: loc3.id },
      { userId: muzilly.id, locationId: loc4.id },
      // Alex: All 4 (Simultaneous Assignment scenario target)
      { userId: alex.id, locationId: loc1.id },
      { userId: alex.id, locationId: loc2.id },
      { userId: alex.id, locationId: loc3.id },
      { userId: alex.id, locationId: loc4.id },
      // Tom: West only
      { userId: tom.id, locationId: loc1.id },
      { userId: tom.id, locationId: loc2.id },
      // Sara: West only
      { userId: sara.id, locationId: loc1.id },
      { userId: sara.id, locationId: loc2.id },
      // Marcus: East only (Sunday Night Chaos coverage candidate)
      { userId: marcus.id, locationId: loc3.id },
      { userId: marcus.id, locationId: loc4.id },
    ],
    skipDuplicates: true,
  });
  console.log('✓  Staff certifications');

  // ═══════════════════════════════════════════════════════════════════════════
  // USER SKILLS
  // ═══════════════════════════════════════════════════════════════════════════
  await prisma.userSkill.createMany({
    data: [
      { userId: jackton.id, skillId: bartender.id },
      { userId: elite.id, skillId: server.id },
      { userId: elite.id, skillId: host.id },
      { userId: javi.id, skillId: lineCook.id },
      { userId: oddie.id, skillId: bartender.id },
      { userId: oddie.id, skillId: server.id },
      { userId: rahab.id, skillId: server.id },
      { userId: muzilly.id, skillId: host.id },
      { userId: muzilly.id, skillId: server.id },
      { userId: alex.id, skillId: bartender.id },
      { userId: alex.id, skillId: server.id },
      { userId: tom.id, skillId: lineCook.id },
      { userId: sara.id, skillId: server.id },
      { userId: sara.id, skillId: host.id },
      { userId: marcus.id, skillId: bartender.id },
      { userId: marcus.id, skillId: server.id },
    ],
    skipDuplicates: true,
  });
  console.log('✓  User skills');

  // ═══════════════════════════════════════════════════════════════════════════
  // AVAILABILITY WINDOWS
  // ═══════════════════════════════════════════════════════════════════════════

  // Jackton: Mon–Fri 10:00–21:00 only → NOT available Sunday → Sunday Night Chaos
  await prisma.availabilityWindow.createMany({
    data: [1, 2, 3, 4, 5].map((dow) => ({
      userId: jackton.id,
      type: 'RECURRING' as const,
      dayOfWeek: dow,
      startTime: '10:00',
      endTime: '21:00',
      isAvailable: true,
    })),
    skipDuplicates: true,
  });
  // Jackton explicitly unavailable Sat-Sun
  await prisma.availabilityWindow.createMany({
    data: [0, 6].map((dow) => ({
      userId: jackton.id,
      type: 'RECURRING' as const,
      dayOfWeek: dow,
      startTime: '00:00',
      endTime: '23:59',
      isAvailable: false,
      note: 'Unavailable weekends',
    })),
    skipDuplicates: true,
  });

  // Elite: 9am–5pm every day → Timezone Tangle (9am PT = 12pm ET, so ET afternoon shifts are out)
  await prisma.availabilityWindow.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((dow) => ({
      userId: elite.id,
      type: 'RECURRING' as const,
      dayOfWeek: dow,
      startTime: '09:00',
      endTime: '17:00',
      isAvailable: true,
      note: 'Available 9am–5pm in my local timezone',
    })),
    skipDuplicates: true,
  });

  // Javi: Tue–Sun open availability (lots of hours for overtime trap)
  await prisma.availabilityWindow.createMany({
    data: [0, 2, 3, 4, 5, 6].map((dow) => ({
      userId: javi.id,
      type: 'RECURRING' as const,
      dayOfWeek: dow,
      startTime: '06:00',
      endTime: '22:00',
      isAvailable: true,
    })),
    skipDuplicates: true,
  });

  // Oddie: All week, open
  await prisma.availabilityWindow.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((dow) => ({
      userId: oddie.id,
      type: 'RECURRING' as const,
      dayOfWeek: dow,
      startTime: '08:00',
      endTime: '23:59',
      isAvailable: true,
    })),
    skipDuplicates: true,
  });

  // Rahab: All week, open (but never gets premium shifts — the complaint)
  await prisma.availabilityWindow.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((dow) => ({
      userId: rahab.id,
      type: 'RECURRING' as const,
      dayOfWeek: dow,
      startTime: '08:00',
      endTime: '23:59',
      isAvailable: true,
    })),
    skipDuplicates: true,
  });

  // Muzilly: All week, open
  await prisma.availabilityWindow.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((dow) => ({
      userId: muzilly.id,
      type: 'RECURRING' as const,
      dayOfWeek: dow,
      startTime: '08:00',
      endTime: '23:59',
      isAvailable: true,
    })),
    skipDuplicates: true,
  });

  // Alex: All week, open
  await prisma.availabilityWindow.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((dow) => ({
      userId: alex.id,
      type: 'RECURRING' as const,
      dayOfWeek: dow,
      startTime: '08:00',
      endTime: '23:59',
      isAvailable: true,
    })),
    skipDuplicates: true,
  });

  // Tom: All week, open (consecutive days scenario — will be assigned Mon–Sat)
  await prisma.availabilityWindow.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((dow) => ({
      userId: tom.id,
      type: 'RECURRING' as const,
      dayOfWeek: dow,
      startTime: '07:00',
      endTime: '20:00',
      isAvailable: true,
    })),
    skipDuplicates: true,
  });

  // Sara: All week, open (under-scheduled for analytics demonstration)
  await prisma.availabilityWindow.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((dow) => ({
      userId: sara.id,
      type: 'RECURRING' as const,
      dayOfWeek: dow,
      startTime: '08:00',
      endTime: '23:59',
      isAvailable: true,
    })),
    skipDuplicates: true,
  });

  // Marcus: All week, open (East Coast coverage candidate)
  await prisma.availabilityWindow.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((dow) => ({
      userId: marcus.id,
      type: 'RECURRING' as const,
      dayOfWeek: dow,
      startTime: '08:00',
      endTime: '23:59',
      isAvailable: true,
    })),
    skipDuplicates: true,
  });

  console.log('✓  Availability windows');

  // ═══════════════════════════════════════════════════════════════════════════
  // DATE ANCHORS
  // ═══════════════════════════════════════════════════════════════════════════
  const thisMonday = getMonday(); // current week Mon
  const lastMonday = getMonday(
    new Date(thisMonday.getTime() - 7 * 24 * 3600_000),
  );
  const nextMonday = new Date(thisMonday.getTime() + 7 * 24 * 3600_000);

  // ═══════════════════════════════════════════════════════════════════════════
  // SHIFTS — LAST WEEK (published, completed — historical/analytics data)
  // ═══════════════════════════════════════════════════════════════════════════
  // Last week shifts establish the historical premium-shift imbalance and
  // build up Tom's consecutive-day count pattern.

  const lastWeekShifts = await prisma.shift.createMany({
    data: [
      // --- West Coast last week ---
      // Javi 4×8h last week (establishes overtime pattern across weeks)
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: lw(lastMonday, 0, 8),
        endAt: lw(lastMonday, 0, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: lastMonday,
      },
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: lw(lastMonday, 1, 8),
        endAt: lw(lastMonday, 1, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: lastMonday,
      },
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: lw(lastMonday, 2, 8),
        endAt: lw(lastMonday, 2, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: lastMonday,
      },
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: lw(lastMonday, 3, 8),
        endAt: lw(lastMonday, 3, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: lastMonday,
      },
      // Tom last week Mon-Sat (establishes consecutive day history)
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: lw(lastMonday, 0, 12),
        endAt: lw(lastMonday, 0, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: lastMonday,
      },
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: lw(lastMonday, 1, 12),
        endAt: lw(lastMonday, 1, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: lastMonday,
      },
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: lw(lastMonday, 2, 12),
        endAt: lw(lastMonday, 2, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: lastMonday,
      },
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: lw(lastMonday, 3, 12),
        endAt: lw(lastMonday, 3, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: lastMonday,
      },
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: lw(lastMonday, 4, 12),
        endAt: lw(lastMonday, 4, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: lastMonday,
      },
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: lw(lastMonday, 5, 12),
        endAt: lw(lastMonday, 5, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: lastMonday,
      },
      // Last week premium Fri/Sat East Coast — Muzilly got both, Rahab got none
      {
        locationId: loc3.id,
        skillId: server.id,
        startAt: lw(lastMonday, 4, 22),
        endAt: lw(lastMonday, 5, 2),
        headcount: 2,
        isPublished: true,
        publishedAt: lastMonday,
        isPremium: true,
      },
      {
        locationId: loc3.id,
        skillId: server.id,
        startAt: lw(lastMonday, 5, 22),
        endAt: lw(lastMonday, 6, 2),
        headcount: 2,
        isPublished: true,
        publishedAt: lastMonday,
        isPremium: true,
      },
      // Rahab last week — non-premium shifts only
      {
        locationId: loc3.id,
        skillId: server.id,
        startAt: lw(lastMonday, 1, 11),
        endAt: lw(lastMonday, 1, 17),
        headcount: 2,
        isPublished: true,
        publishedAt: lastMonday,
      },
      {
        locationId: loc3.id,
        skillId: server.id,
        startAt: lw(lastMonday, 2, 11),
        endAt: lw(lastMonday, 2, 17),
        headcount: 2,
        isPublished: true,
        publishedAt: lastMonday,
      },
      // Jackton last week Mon-Fri (not weekend)
      {
        locationId: loc1.id,
        skillId: bartender.id,
        startAt: lw(lastMonday, 0, 18),
        endAt: lw(lastMonday, 0, 23),
        headcount: 1,
        isPublished: true,
        publishedAt: lastMonday,
      },
      {
        locationId: loc1.id,
        skillId: bartender.id,
        startAt: lw(lastMonday, 2, 18),
        endAt: lw(lastMonday, 2, 23),
        headcount: 1,
        isPublished: true,
        publishedAt: lastMonday,
      },
    ],
  });

  const lastWeekAll = await prisma.shift.findMany({
    where: { startAt: { gte: lastMonday, lt: thisMonday } },
    orderBy: { startAt: 'asc' },
  });

  // Assign last week shifts
  const lwAssignments = [
    // Javi idx 0-3
    { shiftId: lastWeekAll[0].id, userId: javi.id, assignedBy: mgrWest.id },
    { shiftId: lastWeekAll[1].id, userId: javi.id, assignedBy: mgrWest.id },
    { shiftId: lastWeekAll[2].id, userId: javi.id, assignedBy: mgrWest.id },
    { shiftId: lastWeekAll[3].id, userId: javi.id, assignedBy: mgrWest.id },
    // Tom idx 4-9
    { shiftId: lastWeekAll[4].id, userId: tom.id, assignedBy: mgrWest.id },
    { shiftId: lastWeekAll[5].id, userId: tom.id, assignedBy: mgrWest.id },
    { shiftId: lastWeekAll[6].id, userId: tom.id, assignedBy: mgrWest.id },
    { shiftId: lastWeekAll[7].id, userId: tom.id, assignedBy: mgrWest.id },
    { shiftId: lastWeekAll[8].id, userId: tom.id, assignedBy: mgrWest.id },
    { shiftId: lastWeekAll[9].id, userId: tom.id, assignedBy: mgrWest.id },
    // Premium last week idx 10-11: Muzilly both, filling second slot with Rahab (non-premium)
    { shiftId: lastWeekAll[10].id, userId: muzilly.id, assignedBy: mgrEast.id },
    { shiftId: lastWeekAll[11].id, userId: muzilly.id, assignedBy: mgrEast.id },
    // Rahab non-premium last week idx 12-13
    { shiftId: lastWeekAll[12].id, userId: rahab.id, assignedBy: mgrEast.id },
    { shiftId: lastWeekAll[13].id, userId: rahab.id, assignedBy: mgrEast.id },
    // Jackton last week idx 14-15
    { shiftId: lastWeekAll[14].id, userId: jackton.id, assignedBy: mgrWest.id },
    { shiftId: lastWeekAll[15].id, userId: jackton.id, assignedBy: mgrWest.id },
  ];
  await prisma.shiftAssignment.createMany({
    data: lwAssignments,
    skipDuplicates: true,
  });
  console.log('✓  Last week shifts + assignments (historical data)');

  // ═══════════════════════════════════════════════════════════════════════════
  // SHIFTS — THIS WEEK (the main scenarios)
  // ═══════════════════════════════════════════════════════════════════════════

  // UTC offsets: PT = UTC+7 (PDT) or UTC+8 (PST); ET = UTC+4 (EDT) or UTC+5 (EST)
  // Seeds store UTC. PT 6pm = UTC 01:00 next day in winter, UTC 00:00 in summer.
  // We use approximate UTC values that work visually regardless of season.

  await prisma.shift.createMany({
    data: [
      // ── WEST COAST — Santa Monica (loc1) ───────────────────────────────────

      // [0] Mon lunch — server (Sara unfilled, shows under-scheduling)
      {
        locationId: loc1.id,
        skillId: server.id,
        startAt: w(thisMonday, 0, 18),
        endAt: w(thisMonday, 0, 23),
        headcount: 2,
        isPublished: true,
        publishedAt: new Date(),
      },

      // [1] Tue bartender — Oddie assigned, PENDING SWAP with Alex (Regret Swap scenario)
      {
        locationId: loc1.id,
        skillId: bartender.id,
        startAt: w(thisMonday, 1, 18),
        endAt: w(thisMonday, 1, 23),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },

      // [2] Wed evening — server 2-slot (one filled by Elite, one open)
      {
        locationId: loc1.id,
        skillId: server.id,
        startAt: w(thisMonday, 2, 18),
        endAt: w(thisMonday, 2, 23),
        headcount: 2,
        isPublished: true,
        publishedAt: new Date(),
      },

      // [3–6] Overtime Trap — Javi 4×8h shifts (Mon–Thu) = 32h already scheduled
      //        Adding the 5th (Fri) shift triggers overtime warning
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: w(thisMonday, 0, 8),
        endAt: w(thisMonday, 0, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: w(thisMonday, 1, 8),
        endAt: w(thisMonday, 1, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: w(thisMonday, 2, 8),
        endAt: w(thisMonday, 2, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: w(thisMonday, 3, 8),
        endAt: w(thisMonday, 3, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },

      // [7] Fri line cook — unfilled (the 5th shift that triggers Javi overtime warning)
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: w(thisMonday, 4, 8),
        endAt: w(thisMonday, 4, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },

      // [8] Fri DRAFT shift — unpublished (manager still building schedule)
      {
        locationId: loc2.id,
        skillId: bartender.id,
        startAt: w(thisMonday, 4, 18),
        endAt: w(thisMonday, 4, 23),
        headcount: 1,
        isPublished: false,
      },

      // [9] Fri evening premium — West Coast Venice (overnight wraps into Sat)
      {
        locationId: loc2.id,
        skillId: bartender.id,
        startAt: w(thisMonday, 4, 23),
        endAt: w(thisMonday, 5, 3),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
        isPremium: true,
      },

      // ── EAST COAST — Miami Beach (loc3) ────────────────────────────────────

      // [10] Wed host — Muzilly
      {
        locationId: loc3.id,
        skillId: host.id,
        startAt: w(thisMonday, 2, 16),
        endAt: w(thisMonday, 2, 22),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },

      // [11] Thu server — Rahab (non-premium, to further show her fairness complaint)
      {
        locationId: loc3.id,
        skillId: server.id,
        startAt: w(thisMonday, 3, 12),
        endAt: w(thisMonday, 3, 18),
        headcount: 2,
        isPublished: true,
        publishedAt: new Date(),
      },

      // [12] Fri PREMIUM evening East Coast — Muzilly assigned (Rahab complaint: she has this skill but never gets it)
      {
        locationId: loc3.id,
        skillId: server.id,
        startAt: w(thisMonday, 4, 22),
        endAt: w(thisMonday, 5, 2),
        headcount: 2,
        isPublished: true,
        publishedAt: new Date(),
        isPremium: true,
      },

      // [13] Sat PREMIUM evening East Coast — Muzilly assigned again
      {
        locationId: loc3.id,
        skillId: server.id,
        startAt: w(thisMonday, 5, 22),
        endAt: w(thisMonday, 6, 2),
        headcount: 2,
        isPublished: true,
        publishedAt: new Date(),
        isPremium: true,
      },

      // [14] ★ SUNDAY NIGHT CHAOS — 7pm shift, Jackton assigned but will DROP
      //      (Jackton is NOT available Sunday per availability windows)
      {
        locationId: loc1.id,
        skillId: bartender.id,
        startAt: w(thisMonday, 6, 19),
        endAt: w(thisMonday, 6, 23),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },

      // ── TOM — CONSECUTIVE DAYS (Mon–Sat = 6 consecutive, adding Sun triggers override) ─

      // [15–20] Tom Mon–Sat 4h shifts (consecutive 6-day scenario)
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: w(thisMonday, 0, 12),
        endAt: w(thisMonday, 0, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: w(thisMonday, 1, 12),
        endAt: w(thisMonday, 1, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: w(thisMonday, 2, 12),
        endAt: w(thisMonday, 2, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: w(thisMonday, 3, 12),
        endAt: w(thisMonday, 3, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: w(thisMonday, 4, 12),
        endAt: w(thisMonday, 4, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: w(thisMonday, 5, 12),
        endAt: w(thisMonday, 5, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },

      // [21] Sun line cook — assigning Tom here requires override (7th consecutive day)
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: w(thisMonday, 6, 12),
        endAt: w(thisMonday, 6, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },

      // ── FORT LAUDERDALE (loc4) — additional East Coast coverage ───────────

      // [22] Mon host — Marcus
      {
        locationId: loc4.id,
        skillId: host.id,
        startAt: w(thisMonday, 0, 17),
        endAt: w(thisMonday, 0, 23),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },

      // [23] Sat server — Marcus (creates rest violation if also assigned Sunday)
      {
        locationId: loc4.id,
        skillId: server.id,
        startAt: w(thisMonday, 5, 22),
        endAt: w(thisMonday, 6, 4),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },

      // ── TIMEZONE TANGLE — Elite has 9am-5pm availability ─────────────────
      // Elite is certified at loc1 (PT) and loc3 (ET)
      // A 9am PT shift = fine for Elite; a 9am ET shift = also fine
      // But a 5pm ET shift = 2pm PT for Elite — still within 9-5 PT window → OK
      // An 8pm ET shift = 5pm PT for Elite → borderline / out of window

      // [24] Tue morning host loc1 PT — fits Elite 9am-5pm (this shows as valid)
      {
        locationId: loc1.id,
        skillId: host.id,
        startAt: w(thisMonday, 1, 17),
        endAt: w(thisMonday, 1, 21),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },

      // [25] Thu server loc3 ET — 5pm ET = 2pm PT, within Elite's 9-5 window → valid
      {
        locationId: loc3.id,
        skillId: server.id,
        startAt: w(thisMonday, 3, 21),
        endAt: w(thisMonday, 4, 1),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
    ],
  });

  const thisWeekShifts = await prisma.shift.findMany({
    where: { startAt: { gte: thisMonday, lt: nextMonday } },
    orderBy: { startAt: 'asc' },
  });

  // Helper to find shift by index in the ordered list
  const tw = (idx: number) => thisWeekShifts[idx];

  // ── ASSIGNMENTS — THIS WEEK ────────────────────────────────────────────────

  const thisWeekAssignments = [
    // [0] Mon server loc1 — Sara gets one slot, second unfilled (under-scheduling demo)
    { shiftId: tw(0).id, userId: sara.id, assignedBy: mgrWest.id },

    // [1] Tue bartender loc1 — Oddie (will create swap request with Alex)
    { shiftId: tw(1).id, userId: oddie.id, assignedBy: mgrWest.id },

    // [2] Wed server loc1 — Elite fills one slot (Timezone Tangle demo)
    { shiftId: tw(2).id, userId: elite.id, assignedBy: mgrWest.id },

    // [3–6] Javi Mon–Thu 8h each = 32h (overtime warning pending)
    { shiftId: tw(3).id, userId: javi.id, assignedBy: mgrWest.id },
    { shiftId: tw(4).id, userId: javi.id, assignedBy: mgrWest.id },
    { shiftId: tw(5).id, userId: javi.id, assignedBy: mgrWest.id },
    { shiftId: tw(6).id, userId: javi.id, assignedBy: mgrWest.id },
    // [7] Fri cook unfilled — trying to assign Javi triggers 40h warning

    // [9] Overnight Fri→Sat premium — Alex covering
    { shiftId: tw(9).id, userId: alex.id, assignedBy: mgrWest.id },

    // [10] Wed host loc3 — Muzilly
    { shiftId: tw(10).id, userId: muzilly.id, assignedBy: mgrEast.id },

    // [11] Thu server loc3 — Rahab one slot
    { shiftId: tw(11).id, userId: rahab.id, assignedBy: mgrEast.id },

    // [12–13] Fri+Sat premium East Coast — Muzilly both (Fairness Complaint)
    { shiftId: tw(12).id, userId: muzilly.id, assignedBy: mgrEast.id },
    { shiftId: tw(13).id, userId: muzilly.id, assignedBy: mgrEast.id },

    // [14] Sunday Night Chaos — Jackton assigned (will then drop it)
    { shiftId: tw(14).id, userId: jackton.id, assignedBy: mgrWest.id },

    // [15–20] Tom Mon–Sat consecutive 6 days
    { shiftId: tw(15).id, userId: tom.id, assignedBy: mgrWest.id },
    { shiftId: tw(16).id, userId: tom.id, assignedBy: mgrWest.id },
    { shiftId: tw(17).id, userId: tom.id, assignedBy: mgrWest.id },
    { shiftId: tw(18).id, userId: tom.id, assignedBy: mgrWest.id },
    { shiftId: tw(19).id, userId: tom.id, assignedBy: mgrWest.id },
    { shiftId: tw(20).id, userId: tom.id, assignedBy: mgrWest.id },
    // [21] Sun cook — Tom NOT assigned yet (adding him = 7th day, requires override)

    // [22] Mon host loc4 — Marcus
    { shiftId: tw(22).id, userId: marcus.id, assignedBy: mgrEast.id },

    // [24] Tue host loc1 — Elite (Timezone Tangle: PT location, fits 9-5 window)
    { shiftId: tw(24).id, userId: elite.id, assignedBy: mgrWest.id },
  ];

  await prisma.shiftAssignment.createMany({
    data: thisWeekAssignments,
    skipDuplicates: true,
  });
  console.log('✓  This week shifts + assignments');

  // ── NEXT WEEK — published schedule (shows calendar works across weeks) ─────
  await prisma.shift.createMany({
    data: [
      {
        locationId: loc1.id,
        skillId: server.id,
        startAt: w(nextMonday, 0, 18),
        endAt: w(nextMonday, 0, 23),
        headcount: 2,
        isPublished: true,
        publishedAt: new Date(),
      },
      {
        locationId: loc1.id,
        skillId: bartender.id,
        startAt: w(nextMonday, 1, 18),
        endAt: w(nextMonday, 1, 23),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: w(nextMonday, 0, 8),
        endAt: w(nextMonday, 0, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
      {
        locationId: loc3.id,
        skillId: server.id,
        startAt: w(nextMonday, 4, 22),
        endAt: w(nextMonday, 5, 2),
        headcount: 2,
        isPublished: true,
        publishedAt: new Date(),
        isPremium: true,
      },
      {
        locationId: loc3.id,
        skillId: server.id,
        startAt: w(nextMonday, 5, 22),
        endAt: w(nextMonday, 6, 2),
        headcount: 2,
        isPublished: true,
        publishedAt: new Date(),
        isPremium: true,
      },
      // Next week DRAFT shifts (manager still building)
      {
        locationId: loc2.id,
        skillId: bartender.id,
        startAt: w(nextMonday, 2, 18),
        endAt: w(nextMonday, 2, 23),
        headcount: 1,
        isPublished: false,
      },
      {
        locationId: loc4.id,
        skillId: host.id,
        startAt: w(nextMonday, 3, 17),
        endAt: w(nextMonday, 3, 23),
        headcount: 1,
        isPublished: false,
      },
    ],
  });
  console.log('✓  Next week shifts (published + drafts)');

  // ═══════════════════════════════════════════════════════════════════════════
  // SWAP REQUESTS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Scenario 6: Regret Swap ───────────────────────────────────────────────
  // Oddie requested a swap with Alex for Tuesday's bartender shift.
  // The swap is PENDING — Oddie can still cancel it.
  const regretSwap = await prisma.swapRequest.create({
    data: {
      shiftId: tw(1).id,
      requesterId: oddie.id,
      targetId: alex.id,
      type: SwapType.SWAP,
      status: SwapStatus.PENDING,
      requesterNote: 'Family event Tuesday evening — Alex are you free?',
      expiresAt: new Date(tw(1).startAt.getTime() - 24 * 3600_000),
    },
  });

  // ── Scenario 1: Sunday Night Chaos ───────────────────────────────────────
  // Jackton calls out at 6pm Sunday for a 7pm shift → creates a DROP request
  const sundayDrop = await prisma.swapRequest.create({
    data: {
      shiftId: tw(14).id,
      requesterId: jackton.id,
      targetId: null,
      type: SwapType.DROP,
      status: SwapStatus.PENDING,
      requesterNote:
        'Sick — need immediate coverage for my 7pm Sunday bartender shift',
      expiresAt: new Date(tw(14).startAt.getTime() - 1 * 3600_000), // expires 1h before
    },
  });

  // ── Accepted swap (to show full workflow state) ───────────────────────────
  // Rahab requested a swap with Marcus for Thursday's server shift at loc3
  // Marcus accepted, now awaiting manager approval → ACCEPTED state
  const acceptedSwap = await prisma.swapRequest.create({
    data: {
      shiftId: tw(11).id,
      requesterId: rahab.id,
      targetId: marcus.id,
      type: SwapType.SWAP,
      status: SwapStatus.ACCEPTED,
      requesterNote: 'Doctor appointment Thursday afternoon',
      expiresAt: new Date(tw(11).startAt.getTime() - 24 * 3600_000),
    },
  });

  // ── Rejected drop (shows REJECTED state in swap history) ─────────────────
  const rejectedDrop = await prisma.swapRequest.create({
    data: {
      shiftId: tw(10).id, // Wed host loc3
      requesterId: muzilly.id,
      targetId: null,
      type: SwapType.DROP,
      status: SwapStatus.REJECTED,
      requesterNote: 'Wanted to drop this shift',
      managerNote: 'Denied — no available coverage found',
      resolvedAt: new Date(),
      resolvedBy: mgrEast.id,
      expiresAt: new Date(tw(10).startAt.getTime() - 24 * 3600_000),
    },
  });

  console.log(
    '✓  Swap requests (pending drop, pending swap, accepted swap, rejected drop)',
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // OVERTIME OVERRIDE — Tom's 6th consecutive day was approved last week
  // ═══════════════════════════════════════════════════════════════════════════
  await prisma.overtimeOverride.create({
    data: {
      userId: tom.id,
      weekStart: lastMonday,
      authorizedBy: mgrWest.id,
      reason: OvertimeOverrideReason.BUSINESS_NECESSITY,
      notes:
        'Short-staffed during restaurant remodel week — approved by district manager',
    },
  });
  console.log('✓  Overtime override (Tom last week)');

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICATIONS — pre-seeded to populate the notification centre
  // ═══════════════════════════════════════════════════════════════════════════
  const notifData = [
    // Jackton — notified of Sunday shift assignment
    {
      userId: jackton.id,
      type: NotificationType.SHIFT_ASSIGNED,
      isRead: false,
      title: 'New shift assigned',
      body: `You've been assigned a Bartender shift on Sunday at Coastal Eats - Santa Monica (7:00 PM – 11:00 PM).`,
      metadata: { shiftId: tw(14).id, locationId: loc1.id },
    },
    // Oddie — notified their swap request is pending Alex's response
    {
      userId: oddie.id,
      type: NotificationType.SWAP_REQUESTED,
      isRead: false,
      title: 'Swap request sent',
      body: 'Your shift swap request with Alex Kim for Tuesday is awaiting their response.',
      metadata: { swapId: regretSwap.id, shiftId: tw(1).id },
    },
    // Alex — notified of Oddie's swap request
    {
      userId: alex.id,
      type: NotificationType.SWAP_REQUESTED,
      isRead: false,
      title: 'Shift swap request',
      body: 'Oddie Tips has requested to swap their Tuesday Bartender shift with you.',
      metadata: { swapId: regretSwap.id, shiftId: tw(1).id },
    },
    // mgrWest — notified of Jackton's drop request (needs urgent coverage)
    {
      userId: mgrWest.id,
      type: NotificationType.DROP_AVAILABLE,
      isRead: false,
      title: '⚠️ Urgent: Coverage needed Sunday 7pm',
      body: 'Jackton Mtembete has dropped their Sunday bartender shift at Santa Monica (7pm). Shift starts soon — find coverage.',
      metadata: { swapId: sundayDrop.id, shiftId: tw(14).id },
    },
    // mgrEast — notified of accepted swap awaiting approval
    {
      userId: mgrEast.id,
      type: NotificationType.SWAP_ACCEPTED,
      isRead: false,
      title: 'Swap accepted — awaiting your approval',
      body: "Rahab Mwaura and Marcus Webb have agreed to swap Thursday's server shift. Awaiting manager approval.",
      metadata: { swapId: acceptedSwap.id, shiftId: tw(11).id },
    },
    // mgrWest — overtime warning for Javi
    {
      userId: mgrWest.id,
      type: NotificationType.OVERTIME_WARNING,
      isRead: false,
      title: 'Overtime warning — Javi Arts',
      body: "Javi Arts is at 32 scheduled hours this week. Assigning Friday's shift would put them at 40h (overtime threshold).",
      metadata: { userId: javi.id },
    },
    // mgrWest — consecutive day warning for Tom
    {
      userId: mgrWest.id,
      type: NotificationType.CONSECUTIVE_DAY_WARNING,
      isRead: true,
      title: 'Consecutive days warning — Tom Baker',
      body: 'Tom Baker is scheduled for 6 consecutive days (Mon–Sat). Adding Sunday would require a documented override.',
      metadata: { userId: tom.id },
    },
    // Rahab — notified swap accepted by Marcus
    {
      userId: rahab.id,
      type: NotificationType.SWAP_ACCEPTED,
      isRead: false,
      title: 'Swap accepted by Marcus Webb',
      body: 'Marcus Webb accepted your Thursday server shift swap request. Awaiting manager approval.',
      metadata: { swapId: acceptedSwap.id },
    },
    // Muzilly — notified drop rejected
    {
      userId: muzilly.id,
      type: NotificationType.SWAP_REJECTED,
      isRead: true,
      title: 'Drop request rejected',
      body: "Your request to drop Wednesday's host shift was denied: no available coverage found.",
      metadata: { swapId: rejectedDrop.id },
    },
    // Sara — notified of shift assignment
    {
      userId: sara.id,
      type: NotificationType.SHIFT_ASSIGNED,
      isRead: true,
      title: 'New shift assigned',
      body: "You've been assigned a Server shift on Monday at Coastal Eats - Santa Monica (6:00 PM – 11:00 PM).",
      metadata: { shiftId: tw(0).id },
    },
    // Tom — schedule published notification
    {
      userId: tom.id,
      type: NotificationType.SCHEDULE_PUBLISHED,
      isRead: true,
      title: 'Schedule published',
      body: "The week's schedule at Coastal Eats - Santa Monica has been published. You have 6 shifts this week.",
      metadata: { locationId: loc1.id },
    },
    // Elite — shift assignment (Timezone Tangle shift)
    {
      userId: elite.id,
      type: NotificationType.SHIFT_ASSIGNED,
      isRead: false,
      title: 'New shift assigned',
      body: "You've been assigned a Server shift Wednesday at Coastal Eats - Santa Monica. Note: Times shown in PT.",
      metadata: { shiftId: tw(2).id },
    },
  ];

  await prisma.notification.createMany({
    data: notifData,
    skipDuplicates: true,
  });
  console.log('✓  Notifications (12 pre-seeded)');

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIT LOGS — demonstrate audit trail feature
  // ═══════════════════════════════════════════════════════════════════════════
  await prisma.auditLog.createMany({
    data: [
      // Schedule published
      {
        actorId: mgrWest.id,
        entityType: 'Schedule',
        entityId: loc1.id,
        action: 'PUBLISHED',
        after: {
          locationId: loc1.id,
          weekStart: thisMonday.toISOString(),
          shiftsPublished: 14,
        },
        ipAddress: '192.168.1.10',
      },
      // Javi overtime override from last week
      {
        actorId: mgrWest.id,
        entityType: 'OvertimeOverride',
        entityId: tom.id,
        action: 'CREATED',
        after: {
          userId: tom.id,
          reason: 'BUSINESS_NECESSITY',
          weekStart: lastMonday.toISOString(),
        },
        ipAddress: '192.168.1.10',
      },
      // Jackton Sunday assignment
      {
        actorId: mgrWest.id,
        entityType: 'ShiftAssignment',
        entityId: tw(14).id,
        action: 'ASSIGNED',
        before: { assignedCount: 0 },
        after: { userId: jackton.id, shiftId: tw(14).id, status: 'ASSIGNED' },
        ipAddress: '192.168.1.10',
      },
      // Muzilly drop rejected
      {
        actorId: mgrEast.id,
        entityType: 'SwapRequest',
        entityId: rejectedDrop.id,
        action: 'REJECTED',
        before: { status: 'PENDING' },
        after: {
          status: 'REJECTED',
          managerNote: 'No available coverage found',
        },
        ipAddress: '192.168.1.22',
      },
    ],
    skipDuplicates: true,
  });
  console.log('✓  Audit logs');

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                     🎉  ShiftSync Seed Complete                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  LOGIN CREDENTIALS                                                           ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  ADMIN                                                                       ║
║    jackjavi254@gmail.com              /  Admin1234!                          ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  MANAGERS                                                                    ║
║    jackmtembete@gmail.com             /  Manager123!   (West: SM + Venice)  ║
║    devjack650@gmail.com               /  Manager123!   (East: Miami + FtL)  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  STAFF (all password: Staff123!)                                             ║
║    jacktonmtembete@gmail.com          → Sunday Night Chaos (dropped shift)  ║
║    elitebrainsconsulting@gmail.com    → Timezone Tangle (PT+ET certs)       ║
║    javiarts@gmail.com                 → Overtime Trap (32h, 1 shift = 40h)  ║
║    oddtwotips@gmail.com               → Regret Swap (PENDING swap w/ Alex)  ║
║    rahabmwaura96@gmail.com            → Fairness Complaint (0 premium)      ║
║    muzillyamani@gmail.com             → Premium hoarder (3 premium shifts)  ║
║    alex@coastaleats.com               → Swap target + overnight cover       ║
║    tom@coastaleats.com                → 6 consecutive days (7th = override) ║
║    sara@coastaleats.com               → Under-scheduled (8h vs desired 40)  ║
║    marcus@coastaleats.com             → East Coast coverage candidate       ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  ACTIVE SCENARIOS                                                            ║
║  1. Sunday Night Chaos  — Jackton dropped 7pm shift, open DROP pending      ║
║  2. Overtime Trap       — Javi at 32h, Fri shift triggers 40h warning       ║
║  3. Timezone Tangle     — Elite certified PT+ET, 9am-5pm availability       ║
║  4. Simultaneous Assign — Alex available; try assigning from 2 browsers     ║
║  5. Fairness Complaint  — Rahab 0 premium, Muzilly 3 premium this + last wk ║
║  6. Regret Swap         — Oddie/Alex PENDING swap, Oddie can cancel it      ║
║  + Consecutive Days     — Tom 6 days straight, 7th requires override        ║
║  + Overnight Shift      — Alex Fri 11pm→Sat 3am (cross-midnight handling)   ║
║  + Draft Shifts         — Venice Fri bartender unpublished (manager draft)  ║
║  + Under-scheduling     — Sara at 8h vs desired 40h (analytics visible)     ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);
}

main()
  .catch((e) => {
    console.error('\n❌  Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

