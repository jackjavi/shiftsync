import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { OnDutyCronService } from './on-duty.cron';
import { ShiftSyncGateway } from './realtime.gateway';

@Module({
  imports: [AnalyticsModule], // provides AnalyticsService
  providers: [ShiftSyncGateway, OnDutyCronService],
  exports: [ShiftSyncGateway],
})
export class RealtimeModule {}
