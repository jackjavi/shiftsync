import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { EmailModule } from './modules/email/email.module';
import { LocationsModule } from './modules/locations/locations.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OvertimeModule } from './modules/overtime/overtime.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { SchedulingModule } from './modules/scheduling/scheduling.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { SkillsModule } from './modules/skills/skills.module';
import { SwapsModule } from './modules/swaps/swaps.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    // Config — loads .env, global so all modules can use ConfigService
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Event bus for cross-module domain events
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      maxListeners: 20,
      verboseMemoryLeak: true,
    }),

    // Cron job support (@Cron decorators)
    ScheduleModule.forRoot(),

    // Infrastructure
    PrismaModule,

    // Email — @Global() so EmailService is injectable everywhere without importing EmailModule
    EmailModule,

    // Domain modules
    AuthModule,
    UsersModule,
    LocationsModule,
    SkillsModule,
    AvailabilityModule,
    ShiftsModule,
    SchedulingModule,
    SwapsModule,
    OvertimeModule,
    AnalyticsModule,
    NotificationsModule,
    AuditModule,
    RealtimeModule,
  ],
})
export class AppModule {}
