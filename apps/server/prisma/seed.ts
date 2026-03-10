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

  // ── Locations (2 timezones) ───────────────────────────────────────────────
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
  const admin = await prisma.user.upsert({
    where: { email: 'admin@coastaleats.com' },
    update: {},
    create: {
      email: 'admin@coastaleats.com',
      passwordHash: await hash('Admin1234!'),
      name: 'Corporate Admin',
      role: UserRole.ADMIN,
    },
  });

  const mgr1 = await prisma.user.upsert({
    where: { email: 'manager.west@coastaleats.com' },
    update: {},
    create: {
      email: 'manager.west@coastaleats.com',
      passwordHash: await hash('Manager123!'),
      name: 'Maria West',
      role: UserRole.MANAGER,
    },
  });

  const mgr2 = await prisma.user.upsert({
    where: { email: 'manager.east@coastaleats.com' },
    update: {},
    create: {
      email: 'manager.east@coastaleats.com',
      passwordHash: await hash('Manager123!'),
      name: 'James East',
      role: UserRole.MANAGER,
    },
  });

  // Staff members
  const staff = await Promise.all([
    // Sarah — bartender, West Coast only, available Mon-Fri
    prisma.user.upsert({
      where: { email: 'sarah@coastaleats.com' },
      update: {},
      create: {
        email: 'sarah@coastaleats.com',
        passwordHash: await hash('Staff123!'),
        name: 'Sarah Connor',
        role: UserRole.STAFF,
        desiredHoursPerWeek: 30,
      },
    }),
    // John — server + host, both coasts (Timezone Tangle scenario)
    prisma.user.upsert({
      where: { email: 'john@coastaleats.com' },
      update: {},
      create: {
        email: 'john@coastaleats.com',
        passwordHash: await hash('Staff123!'),
        name: 'John Rivera',
        role: UserRole.STAFF,
        desiredHoursPerWeek: 40,
      },
    }),
    // Emma — line cook, approaches overtime this week
    prisma.user.upsert({
      where: { email: 'emma@coastaleats.com' },
      update: {},
      create: {
        email: 'emma@coastaleats.com',
        passwordHash: await hash('Staff123!'),
        name: 'Emma Thompson',
        role: UserRole.STAFF,
        desiredHoursPerWeek: 35,
      },
    }),
    // Carlos — bartender + server, West Coast
    prisma.user.upsert({
      where: { email: 'carlos@coastaleats.com' },
      update: {},
      create: {
        email: 'carlos@coastaleats.com',
        passwordHash: await hash('Staff123!'),
        name: 'Carlos Mendez',
        role: UserRole.STAFF,
        desiredHoursPerWeek: 25,
      },
    }),
    // Lisa — server, East Coast, claims she never gets premium shifts
    prisma.user.upsert({
      where: { email: 'lisa@coastaleats.com' },
      update: {},
      create: {
        email: 'lisa@coastaleats.com',
        passwordHash: await hash('Staff123!'),
        name: 'Lisa Park',
        role: UserRole.STAFF,
        desiredHoursPerWeek: 32,
      },
    }),
    // Mike — host + server, East Coast
    prisma.user.upsert({
      where: { email: 'mike@coastaleats.com' },
      update: {},
      create: {
        email: 'mike@coastaleats.com',
        passwordHash: await hash('Staff123!'),
        name: 'Mike Johnson',
        role: UserRole.STAFF,
        desiredHoursPerWeek: 20,
      },
    }),
    // Alex — bartender, all locations
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
    // Tom — line cook, West Coast, about to hit 7th consecutive day
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

  const [sarah, john, emma, carlos, lisa, mike, alex, tom] = staff;
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
      // Sarah: West Coast only
      { userId: sarah.id, locationId: loc1.id },
      { userId: sarah.id, locationId: loc2.id },
      // John: BOTH coasts (Timezone Tangle scenario)
      { userId: john.id, locationId: loc1.id },
      { userId: john.id, locationId: loc2.id },
      { userId: john.id, locationId: loc3.id },
      { userId: john.id, locationId: loc4.id },
      // Emma: West Coast
      { userId: emma.id, locationId: loc1.id },
      { userId: emma.id, locationId: loc2.id },
      // Carlos: West Coast
      { userId: carlos.id, locationId: loc1.id },
      { userId: carlos.id, locationId: loc2.id },
      // Lisa: East Coast
      { userId: lisa.id, locationId: loc3.id },
      { userId: lisa.id, locationId: loc4.id },
      // Mike: East Coast
      { userId: mike.id, locationId: loc3.id },
      { userId: mike.id, locationId: loc4.id },
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
      { userId: sarah.id, skillId: bartender.id },
      { userId: john.id, skillId: server.id },
      { userId: john.id, skillId: host.id },
      { userId: emma.id, skillId: lineCook.id },
      { userId: carlos.id, skillId: bartender.id },
      { userId: carlos.id, skillId: server.id },
      { userId: lisa.id, skillId: server.id },
      { userId: mike.id, skillId: host.id },
      { userId: mike.id, skillId: server.id },
      { userId: alex.id, skillId: bartender.id },
      { userId: tom.id, skillId: lineCook.id },
    ],
    skipDuplicates: true,
  });
  console.log('✓ Skills assigned');

  // ── Availability Windows ──────────────────────────────────────────────────
  // Sarah: Mon-Fri 10am-9pm PT only
  await prisma.availabilityWindow.createMany({
    data: [1, 2, 3, 4, 5].map((day) => ({
      userId: sarah.id,
      type: 'RECURRING',
      dayOfWeek: day,
      startTime: '10:00',
      endTime: '21:00',
      isAvailable: true,
    })),
    skipDuplicates: true,
  });

  // John: 7 days, 9am-5pm (Timezone Tangle: evaluated per location TZ)
  await prisma.availabilityWindow.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      userId: john.id,
      type: 'RECURRING',
      dayOfWeek: day,
      startTime: '09:00',
      endTime: '17:00',
      isAvailable: true,
    })),
    skipDuplicates: true,
  });

  // Emma: 6 days (approaching consecutive day warning)
  await prisma.availabilityWindow.createMany({
    data: [1, 2, 3, 4, 5, 6].map((day) => ({
      userId: emma.id,
      type: 'RECURRING',
      dayOfWeek: day,
      startTime: '08:00',
      endTime: '20:00',
      isAvailable: true,
    })),
    skipDuplicates: true,
  });

  // All others: open availability (all 7 days)
  for (const staffMember of [carlos, lisa, mike, alex, tom]) {
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
  // Use next Monday as base
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

  // Published shifts for the week
  const publishedShifts = await prisma.shift.createMany({
    data: [
      // Loc1 Monday lunch
      {
        locationId: loc1.id,
        skillId: server.id,
        startAt: day(0, 18),
        endAt: day(0, 23),
        headcount: 2,
        isPublished: true,
        publishedAt: new Date(),
      },
      // Loc1 Tuesday dinner
      {
        locationId: loc1.id,
        skillId: bartender.id,
        startAt: day(1, 18),
        endAt: day(1, 23),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
      // Loc1 Wednesday cook shift
      {
        locationId: loc1.id,
        skillId: lineCook.id,
        startAt: day(2, 16),
        endAt: day(2, 23),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
      // Emma overtime trap — 5 shifts this week already adding up to ~34h
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
      // Friday premium shift (loc3 East coast — Lisa fairness complaint)
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
      // Saturday premium (loc3)
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
      // Sunday 7pm — the Sunday Night Chaos shift (assigned, no coverage)
      {
        locationId: loc1.id,
        skillId: bartender.id,
        startAt: day(6, 19),
        endAt: day(6, 23),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
      // Overnight shift (11pm–3am, overnight) — tests overnight shift handling
      {
        locationId: loc2.id,
        skillId: bartender.id,
        startAt: day(4, 23),
        endAt: day(5, 3),
        headcount: 1,
        isPublished: true,
        publishedAt: new Date(),
      },
      // Tom consecutive days — 6 shifts across Mon-Sat
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

  // Get shift IDs for assignments
  const allShifts = await prisma.shift.findMany({
    orderBy: { createdAt: 'asc' },
  });

  // Assign Emma to the overtime-trap shifts (indexes 3-6)
  await prisma.shiftAssignment.createMany({
    data: [
      { shiftId: allShifts[3].id, userId: emma.id, assignedBy: mgr1.id },
      { shiftId: allShifts[4].id, userId: emma.id, assignedBy: mgr1.id },
      { shiftId: allShifts[5].id, userId: emma.id, assignedBy: mgr1.id },
      { shiftId: allShifts[6].id, userId: emma.id, assignedBy: mgr1.id },
    ],
    skipDuplicates: true,
  });

  // Assign Sarah to the Sunday Night Chaos shift (index 9)
  await prisma.shiftAssignment.createMany({
    data: [{ shiftId: allShifts[9].id, userId: sarah.id, assignedBy: mgr1.id }],
    skipDuplicates: true,
  });

  // Assign Lisa to some premium shifts (not all — to simulate unfairness complaint)
  await prisma.shiftAssignment.createMany({
    data: [
      { shiftId: allShifts[7].id, userId: mike.id, assignedBy: mgr2.id },
      { shiftId: allShifts[8].id, userId: mike.id, assignedBy: mgr2.id },
      // Lisa gets none — she will claim unfairness
    ],
    skipDuplicates: true,
  });

  // Assign Tom to 6 consecutive days
  await prisma.shiftAssignment.createMany({
    data: allShifts
      .slice(11, 17)
      .map((s) => ({ shiftId: s.id, userId: tom.id, assignedBy: mgr1.id })),
    skipDuplicates: true,
  });

  // Assign Carlos to the regular bar shift + create pending swap (Regret Swap scenario)
  await prisma.shiftAssignment.createMany({
    data: [
      { shiftId: allShifts[1].id, userId: carlos.id, assignedBy: mgr1.id },
    ],
    skipDuplicates: true,
  });

  // Carlos requests a swap with Alex (both bartenders)
  await prisma.swapRequest.create({
    data: {
      shiftId: allShifts[1].id,
      requesterId: carlos.id,
      targetId: alex.id,
      type: SwapType.SWAP,
      status: SwapStatus.PENDING,
      requesterNote: 'Family event Tuesday',
      expiresAt: new Date(allShifts[1].startAt.getTime() - 24 * 60 * 60 * 1000),
    },
  });

  // Sarah creates a DROP request for her Sunday shift
  await prisma.swapRequest.create({
    data: {
      shiftId: allShifts[9].id,
      requesterId: sarah.id,
      targetId: null,
      type: SwapType.DROP,
      status: SwapStatus.PENDING,
      requesterNote: 'Sick — need someone to cover my 7pm Sunday shift',
      expiresAt: new Date(allShifts[9].startAt.getTime() - 24 * 60 * 60 * 1000),
    },
  });

  console.log('✓ Assignments and swap requests created');
  console.log('\n🎉 Seed complete! Login credentials:');
  console.log('  Admin:   admin@coastaleats.com / Admin1234!');
  console.log('  Manager West: manager.west@coastaleats.com / Manager123!');
  console.log('  Manager East: manager.east@coastaleats.com / Manager123!');
  console.log('  Staff:   sarah@coastaleats.com / Staff123!');
  console.log(
    '  Staff:   john@coastaleats.com  / Staff123!  (both coasts — Timezone Tangle)',
  );
  console.log(
    '  Staff:   emma@coastaleats.com  / Staff123!  (approaching overtime)',
  );
  console.log(
    '  Staff:   lisa@coastaleats.com  / Staff123!  (fairness complaint)',
  );
  console.log(
    '  Staff:   tom@coastaleats.com   / Staff123!  (6 consecutive days)',
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
