import {
  PrismaClient,
  UserRole,
  SwapType,
  SwapStatus,
  // AssignmentStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaPg } from '@prisma/adapter-pg';
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });
const HASH_ROUNDS = 10;

async function hash(pw: string) {
  return bcrypt.hash(pw, HASH_ROUNDS);
}

async function main() {
  console.log('🌱 Seeding ShiftSync database...');

  // ── Skills ────────────────────────────────────────────────────────────────
  const skills = await Promise.all([
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
  const [bartender, lineCook, server, host] = skills;
  console.log('✓ Skills created');

  // ── Locations (2 timezones, 4 branches) ──────────────────────────────────
  const loc1 = await prisma.location.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'Coastal Eats - Santa Monica',
      address: '123 Ocean Ave, Santa Monica, CA',
      timezone: 'America/Los_Angeles',
    },
  });
  const loc2 = await prisma.location.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      name: 'Coastal Eats - Venice Beach',
      address: '456 Boardwalk, Venice, CA',
      timezone: 'America/Los_Angeles',
    },
  });
  const loc3 = await prisma.location.upsert({
    where: { id: 3 },
    update: {},
    create: {
      id: 3,
      name: 'Coastal Eats - Miami Beach',
      address: '789 Collins Ave, Miami Beach, FL',
      timezone: 'America/New_York',
    },
  });
  const loc4 = await prisma.location.upsert({
    where: { id: 4 },
    update: {},
    create: {
      id: 4,
      name: 'Coastal Eats - Fort Lauderdale',
      address: '321 Las Olas Blvd, Fort Lauderdale, FL',
      timezone: 'America/New_York',
    },
  });
  console.log('✓ Locations created');

  // ── Users ─────────────────────────────────────────────────────────────────
  //  Email mapping:
  //    jackjavi254@gmail.com         → Admin
  //    jackmtembete@gmail.com        → Manager West  (Santa Monica + Venice Beach)
  //    devjack650@gmail.com          → Manager East  (Miami Beach + Fort Lauderdale)
  //    jacktonmtembete@gmail.com     → Jackton  – bartender, West Coast  (Sunday Night Chaos)
  //    elitebrainsconsulting@gmail.com → Elite  – server+host, both coasts (Timezone Tangle)
  //    javiarts@gmail.com            → Javi    – line cook, West Coast  (Overtime Trap)
  //    oddtwotips@gmail.com          → Oddie   – bartender, West Coast  (Regret Swap)
  //    rahabmwaura96@gmail.com       → Rahab   – server, East Coast    (Fairness Complaint)
  //    muzillyamani@gmail.com        → Muzilly – host+server, East Coast
  //    alex@coastaleats.com          → Alex Kim – bartender, all locations
  //    tom@coastaleats.com           → Tom Baker – line cook, West Coast (Consecutive Days)

  const admin = await prisma.user.upsert({
    where: { email: 'jackjavi254@gmail.com' },
    update: {},
    create: {
      email: 'jackjavi254@gmail.com',
      passwordHash: await hash('Admin1234!'),
      name: 'Jack Javi',
      role: UserRole.ADMIN,
    },
  });

  const mgr1 = await prisma.user.upsert({
    where: { email: 'jackmtembete@gmail.com' },
    update: {},
    create: {
      email: 'jackmtembete@gmail.com',
      passwordHash: await hash('Manager123!'),
      name: 'Jack Mtembete',
      role: UserRole.MANAGER,
    },
  });

  const mgr2 = await prisma.user.upsert({
    where: { email: 'devjack650@gmail.com' },
    update: {},
    create: {
      email: 'devjack650@gmail.com',
      passwordHash: await hash('Manager123!'),
      name: 'Dev Jack',
      role: UserRole.MANAGER,
    },
  });

  // Staff
  const staff = await Promise.all([
    // Jackton — bartender, West Coast, available Mon-Fri (Sunday Night Chaos scenario)
    prisma.user.upsert({
      where: { email: 'jacktonmtembete@gmail.com' },
      update: {},
      create: {
        email: 'jacktonmtembete@gmail.com',
        passwordHash: await hash('Staff123!'),
        name: 'Jackton Mtembete',
        role: UserRole.STAFF,
        desiredHoursPerWeek: 30,
      },
    }),
    // Elite — server + host, both coasts (Timezone Tangle scenario)
    prisma.user.upsert({
      where: { email: 'elitebrainsconsulting@gmail.com' },
      update: {},
      create: {
        email: 'elitebrainsconsulting@gmail.com',
        passwordHash: await hash('Staff123!'),
        name: 'Elite Brain',
        role: UserRole.STAFF,
        desiredHoursPerWeek: 40,
      },
    }),
    // Javi — line cook, West Coast (Overtime Trap scenario)
    prisma.user.upsert({
      where: { email: 'javiarts@gmail.com' },
      update: {},
      create: {
        email: 'javiarts@gmail.com',
        passwordHash: await hash('Staff123!'),
        name: 'Javi Arts',
        role: UserRole.STAFF,
        desiredHoursPerWeek: 35,
      },
    }),
    // Oddie — bartender + server, West Coast (Regret Swap scenario)
    prisma.user.upsert({
      where: { email: 'oddtwotips@gmail.com' },
      update: {},
      create: {
        email: 'oddtwotips@gmail.com',
        passwordHash: await hash('Staff123!'),
        name: 'Oddie Tips',
        role: UserRole.STAFF,
        desiredHoursPerWeek: 25,
      },
    }),
    // Rahab — server, East Coast, 0 premium shifts (Fairness Complaint scenario)
    prisma.user.upsert({
      where: { email: 'rahabmwaura96@gmail.com' },
      update: {},
      create: {
        email: 'rahabmwaura96@gmail.com',
        passwordHash: await hash('Staff123!'),
        name: 'Rahab Mwaura',
        role: UserRole.STAFF,
        desiredHoursPerWeek: 32,
      },
    }),
    // Muzilly — host + server, East Coast (premium shift fairness foil)
    prisma.user.upsert({
      where: { email: 'muzillyamani@gmail.com' },
      update: {},
      create: {
        email: 'muzillyamani@gmail.com',
        passwordHash: await hash('Staff123!'),
        name: 'Muzilly Amani',
        role: UserRole.STAFF,
        desiredHoursPerWeek: 20,
      },
    }),
    // Alex — bartender, all locations (Regret Swap target)
    prisma.user.upsert({
      where: { email: 'alex@coastaleats.com' },
      update: {},
      create: {
        email: 'alex@coastaleats.com',
        passwordHash: await hash('Staff123!'),
        name: 'Alex Kim',
        role: UserRole.STAFF,
        desiredHoursPerWeek: 40,
      },
    }),
    // Tom — line cook, West Coast (Consecutive Days scenario)
    prisma.user.upsert({
      where: { email: 'tom@coastaleats.com' },
      update: {},
      create: {
        email: 'tom@coastaleats.com',
        passwordHash: await hash('Staff123!'),
        name: 'Tom Baker',
        role: UserRole.STAFF,
        desiredHoursPerWeek: 40,
      },
    }),
  ]);

  const [jackton, elite, javi, oddie, rahab, muzilly, alex, tom] = staff;
  console.log('✓ Users created');

  // ── Manager Location Assignments ─────────────────────────────────────────
  await prisma.locationManager.createMany({
    data: [
      { userId: mgr1.id, locationId: loc1.id },
      { userId: mgr1.id, locationId: loc2.id },
      { userId: mgr2.id, locationId: loc3.id },
      { userId: mgr2.id, locationId: loc4.id },
    ],
    skipDuplicates: true,
  });
  console.log('✓ Manager assignments created');

  // ── Staff Certifications ──────────────────────────────────────────────────
  await prisma.staffCertification.createMany({
    data: [
      // Jackton: West Coast only
      { userId: jackton.id, locationId: loc1.id },
      { userId: jackton.id, locationId: loc2.id },
      // Elite: BOTH coasts (Timezone Tangle scenario)
      { userId: elite.id, locationId: loc1.id },
      { userId: elite.id, locationId: loc2.id },
      { userId: elite.id, locationId: loc3.id },
      { userId: elite.id, locationId: loc4.id },
      // Javi: West Coast
      { userId: javi.id, locationId: loc1.id },
      { userId: javi.id, locationId: loc2.id },
      // Oddie: West Coast
      { userId: oddie.id, locationId: loc1.id },
      { userId: oddie.id, locationId: loc2.id },
      // Rahab: East Coast
      { userId: rahab.id, locationId: loc3.id },
      { userId: rahab.id, locationId: loc4.id },
      // Muzilly: East Coast
      { userId: muzilly.id, locationId: loc3.id },
      { userId: muzilly.id, locationId: loc4.id },
      // Alex: All locations
      { userId: alex.id, locationId: loc1.id },
      { userId: alex.id, locationId: loc2.id },
      { userId: alex.id, locationId: loc3.id },
      { userId: alex.id, locationId: loc4.id },
      // Tom: West Coast
      { userId: tom.id, locationId: loc1.id },
      { userId: tom.id, locationId: loc2.id },
    ],
    skipDuplicates: true,
  });
  console.log('✓ Certifications created');

  // ── User Skills ───────────────────────────────────────────────────────────
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
      { userId: tom.id, skillId: lineCook.id },
    ],
    skipDuplicates: true,
  });
  console.log('✓ Skills assigned');

  // ── Availability Windows ──────────────────────────────────────────────────
  // Jackton: Mon-Fri 10am-9pm PT (mirrors Sarah's original availability)
  await prisma.availabilityWindow.createMany({
    data: [1, 2, 3, 4, 5].map((day) => ({
      userId: jackton.id,
      type: 'RECURRING',
      dayOfWeek: day,
      startTime: '10:00',
      endTime: '21:00',
      isAvailable: true,
    })),
    skipDuplicates: true,
  });

  // Elite: 7 days, 9am-5pm (Timezone Tangle: evaluated per location TZ)
  await prisma.availabilityWindow.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      userId: elite.id,
      type: 'RECURRING',
      dayOfWeek: day,
      startTime: '09:00',
      endTime: '17:00',
      isAvailable: true,
    })),
    skipDuplicates: true,
  });

  // Javi: 6 days (Tue-Sun, approaching consecutive day warning)
  await prisma.availabilityWindow.createMany({
    data: [1, 2, 3, 4, 5, 6].map((day) => ({
      userId: javi.id,
      type: 'RECURRING',
      dayOfWeek: day,
      startTime: '08:00',
      endTime: '20:00',
      isAvailable: true,
    })),
    skipDuplicates: true,
  });

  // All others: open availability (all 7 days)
  for (const staffMember of [oddie, rahab, muzilly, alex, tom]) {
    await prisma.availabilityWindow.createMany({
      data: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
        userId: staffMember.id,
        type: 'RECURRING',
        dayOfWeek: day,
        startTime: '08:00',
        endTime: '23:59',
        isAvailable: true,
      })),
      skipDuplicates: true,
    });
  }
  console.log('✓ Availability windows created');

  // ── Shifts — This Week (Published) ───────────────────────────────────────
  const now = new Date();
  const daysToMonday = (8 - now.getUTCDay()) % 7 || 7;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + daysToMonday);
  monday.setUTCHours(0, 0, 0, 0);

  const day = (offsetDays: number, hours: number) => {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + offsetDays);
    d.setUTCHours(hours, 0, 0, 0);
    return d;
  };

  await prisma.shift.createMany({
    data: [
      // idx 0 — Loc1 Monday evening server shift
      {
        locationId: loc1.id,
        skillId: server.id,
        startAt: day(0, 18),
        endAt: day(0, 23),
        headcount: 2,
        isPublished: true,
        publishedAt: new Date(),
      },
      // idx 1 — Loc1 Tuesday bartender (Oddie is assigned; Regret Swap scenario)
      {
        locationId: loc1.id,
        skillId: bartender.id,
        startAt: day(1, 18),
        endAt: day(1, 23),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
      // idx 2 — Loc1 Wednesday cook shift
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: day(2, 16),
        endAt: day(2, 23),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
      // idx 3-6 — Javi overtime trap (4 × 8h = 32h, adding a 5th would breach 40h)
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: day(0, 8),
        endAt: day(0, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: day(1, 8),
        endAt: day(1, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: day(2, 8),
        endAt: day(2, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: day(3, 8),
        endAt: day(3, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
      // idx 7 — Friday premium East Coast (Fairness Complaint — Muzilly has it, Rahab doesn't)
      {
        locationId: loc3.id,
        skillId: server.id,
        startAt: day(4, 17),
        endAt: day(4, 23),
        headcount: 2,
        isPublished: true,
        publishedAt: new Date(),
        isPremium: true,
      },
      // idx 8 — Saturday premium East Coast
      {
        locationId: loc3.id,
        skillId: server.id,
        startAt: day(5, 17),
        endAt: day(5, 23),
        headcount: 2,
        isPublished: true,
        publishedAt: new Date(),
        isPremium: true,
      },
      // idx 9 — Sunday 7pm (Sunday Night Chaos — Jackton drops it)
      {
        locationId: loc1.id,
        skillId: bartender.id,
        startAt: day(6, 19),
        endAt: day(6, 23),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
      // idx 10 — Overnight shift (tests overnight handling)
      {
        locationId: loc2.id,
        skillId: bartender.id,
        startAt: day(4, 23),
        endAt: day(5, 3),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
      // idx 11-16 — Tom consecutive days (Mon–Sat, 6 in a row)
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: day(0, 12),
        endAt: day(0, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: day(1, 12),
        endAt: day(1, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: day(2, 12),
        endAt: day(2, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: day(3, 12),
        endAt: day(3, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: day(4, 12),
        endAt: day(4, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: day(5, 12),
        endAt: day(5, 16),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
    ],
  });
  console.log('✓ Published shifts created');

  const allShifts = await prisma.shift.findMany({
    orderBy: { createdAt: 'asc' },
  });

  // Assign Javi to overtime-trap shifts (idx 3-6)
  await prisma.shiftAssignment.createMany({
    data: [3, 4, 5, 6].map((i) => ({
      shiftId: allShifts[i].id,
      userId: javi.id,
      assignedBy: mgr1.id,
    })),
    skipDuplicates: true,
  });

  // Assign Jackton to the Sunday Night Chaos shift (idx 9) — she will DROP it
  await prisma.shiftAssignment.createMany({
    data: [
      { shiftId: allShifts[9].id, userId: jackton.id, assignedBy: mgr1.id },
    ],
    skipDuplicates: true,
  });

  // Fairness: Muzilly gets both premium shifts; Rahab gets none
  await prisma.shiftAssignment.createMany({
    data: [
      { shiftId: allShifts[7].id, userId: muzilly.id, assignedBy: mgr2.id },
      { shiftId: allShifts[8].id, userId: muzilly.id, assignedBy: mgr2.id },
    ],
    skipDuplicates: true,
  });

  // Tom consecutive 6 days (idx 11-16)
  await prisma.shiftAssignment.createMany({
    data: allShifts
      .slice(11, 17)
      .map((s) => ({ shiftId: s.id, userId: tom.id, assignedBy: mgr1.id })),
    skipDuplicates: true,
  });

  // Oddie on the Tuesday bartender shift (idx 1)
  await prisma.shiftAssignment.createMany({
    data: [{ shiftId: allShifts[1].id, userId: oddie.id, assignedBy: mgr1.id }],
    skipDuplicates: true,
  });

  // Regret Swap: Oddie requests swap with Alex
  await prisma.swapRequest.create({
    data: {
      shiftId: allShifts[1].id,
      requesterId: oddie.id,
      targetId: alex.id,
      type: SwapType.SWAP,
      status: SwapStatus.PENDING,
      requesterNote: 'Family event on Tuesday — can Alex cover?',
      expiresAt: new Date(allShifts[1].startAt.getTime() - 24 * 60 * 60 * 1000),
    },
  });

  // Sunday Night Chaos: Jackton creates a DROP request
  await prisma.swapRequest.create({
    data: {
      shiftId: allShifts[9].id,
      requesterId: jackton.id,
      targetId: null,
      type: SwapType.DROP,
      status: SwapStatus.PENDING,
      requesterNote: 'Sick — need someone to cover my 7pm Sunday shift',
      expiresAt: new Date(allShifts[9].startAt.getTime() - 24 * 60 * 60 * 1000),
    },
  });

  console.log('✓ Assignments and swap requests created');
  console.log('\n🎉 Seed complete! Login credentials:');
  console.log('  Admin:          jackjavi254@gmail.com          / Admin1234!');
  console.log('  Manager West:   jackmtembete@gmail.com         / Manager123!');
  console.log('  Manager East:   devjack650@gmail.com           / Manager123!');
  console.log(
    '  Staff:          jacktonmtembete@gmail.com      / Staff123!   (Sunday Night Chaos)',
  );
  console.log(
    '  Staff:          elitebrainsconsulting@gmail.com / Staff123!  (Timezone Tangle)',
  );
  console.log(
    '  Staff:          javiarts@gmail.com             / Staff123!   (Overtime Trap)',
  );
  console.log(
    '  Staff:          oddtwotips@gmail.com           / Staff123!   (Regret Swap)',
  );
  console.log(
    '  Staff:          rahabmwaura96@gmail.com        / Staff123!   (Fairness Complaint)',
  );
  console.log(
    '  Staff:          muzillyamani@gmail.com         / Staff123!   (Premium Foil)',
  );
  console.log(
    '  Staff:          alex@coastaleats.com           / Staff123!   (Swap target)',
  );
  console.log(
    '  Staff:          tom@coastaleats.com            / Staff123!   (Consecutive Days)',
  );
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });