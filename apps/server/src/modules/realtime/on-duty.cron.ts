import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AnalyticsService } from '../analytics/analytics.service';
import { ShiftSyncGateway } from './realtime.gateway';

/**
 * OnDutyCron
 *
 * Runs every minute. Queries the active assignments across all locations and
 * pushes the result to every connected client in the corresponding
 * `location:<id>` Socket.IO room via `on-duty.update`.
 *
 * This replaces the HTTP-polling fallback on the client and provides true
 * server-push for the live "who is on duty" panel.
 */
@Injectable()
export class OnDutyCronService {
  private readonly logger = new Logger(OnDutyCronService.name);

  constructor(
    private readonly analytics: AnalyticsService,
    private readonly gateway: ShiftSyncGateway,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async pushOnDutyUpdates() {
    try {
      const locations = await this.analytics.getOnDutyNow();

      if (!locations || locations.length === 0) return;

      for (const loc of locations) {
        this.gateway.emitOnDutyUpdate(loc.locationId, loc.staff);
      }

      this.logger.debug(
        `On-duty push: ${locations.length} location(s), ` +
          `${locations.reduce((sum, l) => sum + l.staff.length, 0)} staff on duty`,
      );
    } catch (err: unknown) {
      this.logger.error(
        `On-duty cron failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
