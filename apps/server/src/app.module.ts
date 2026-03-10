import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule } from './modules/prisma/prisma.module';

@Module({
  imports: [
    // Config — loads .env
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

    // Cron job support
    ScheduleModule.forRoot(),

    // Infrastructure
    PrismaModule,
  ],
})
export class AppModule {}
