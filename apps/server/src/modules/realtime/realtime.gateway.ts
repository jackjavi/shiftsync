import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.CLIENT_URL ?? 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/',
})
export class ShiftSyncGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ShiftSyncGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /** Client joins their personal notification room */
  @SubscribeMessage('join:user')
  handleJoinUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: number },
  ) {
    client.join(`user:${data.userId}`);
  }

  /** Client joins a location room (for managers watching a location) */
  @SubscribeMessage('join:location')
  handleJoinLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { locationId: number },
  ) {
    client.join(`location:${data.locationId}`);
  }

  /** Client joins admin room */
  @SubscribeMessage('join:admin')
  handleJoinAdmin(@ConnectedSocket() client: Socket) {
    client.join('admin');
  }

  // ── Domain event → WebSocket emission ────────────────────────────────────

  @OnEvent('notification.created')
  handleNotificationCreated(payload: { notification: any }) {
    const { notification } = payload;
    this.server
      .to(`user:${notification.userId}`)
      .emit('notification', notification);
  }

  @OnEvent('schedule.published')
  handleSchedulePublished(payload: { locationId: number; shiftIds: number[] }) {
    this.server
      .to(`location:${payload.locationId}`)
      .emit('schedule.published', payload);
  }

  @OnEvent('shift.updated')
  handleShiftUpdated(payload: { shift: any }) {
    this.server
      .to(`location:${payload.shift.locationId}`)
      .emit('shift.updated', payload.shift);
  }

  @OnEvent('assignment.created')
  handleAssignmentCreated(payload: { assignment: any }) {
    const { assignment } = payload;
    // Notify the assigned staff member
    this.server
      .to(`user:${assignment.userId}`)
      .emit('assignment.created', assignment);
    // Notify location room
    this.server
      .to(`location:${assignment.shift?.locationId}`)
      .emit('assignment.created', assignment);
  }

  @OnEvent('assignment.conflict')
  handleAssignmentConflict(payload: {
    userId: number;
    shiftId: number;
    actorId: number;
  }) {
    // Notify the manager who lost the race
    this.server
      .to(`user:${payload.actorId}`)
      .emit('assignment.conflict', {
        message: 'Another manager just assigned this staff member',
        shiftId: payload.shiftId,
        userId: payload.userId,
      });
  }

  @OnEvent('swap.created')
  handleSwapCreated(payload: { swapRequest: any }) {
    const { swapRequest } = payload;
    if (swapRequest.targetId) {
      this.server
        .to(`user:${swapRequest.targetId}`)
        .emit('swap.requested', swapRequest);
    }
    this.server
      .to(`location:${swapRequest.shift?.locationId}`)
      .emit('swap.new_drop', swapRequest);
  }

  @OnEvent('swap.approved')
  handleSwapApproved(payload: { swap: any }) {
    const { swap } = payload;
    this.server.to(`user:${swap.requesterId}`).emit('swap.approved', swap);
    if (swap.targetId) {
      this.server.to(`user:${swap.targetId}`).emit('swap.approved', swap);
    }
  }

  /** Emit on-duty update every minute for the live dashboard */
  emitOnDutyUpdate(locationId: number, staff: any[]) {
    this.server
      .to(`location:${locationId}`)
      .emit('on-duty.update', { locationId, staff, timestamp: new Date() });
  }
}
