import { Module } from '@nestjs/common';
import { ShiftSyncGateway } from './realtime.gateway';

@Module({
  providers: [ShiftSyncGateway],
  exports: [ShiftSyncGateway],
})
export class RealtimeModule {}
