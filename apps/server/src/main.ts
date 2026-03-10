import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './modules/shared/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3001);
  const clientUrl = configService.get<string>(
    'CLIENT_URL',
    'http://localhost:3000',
  );

  // CORS — allow client origin + WebSocket
  app.enableCors({
    origin: [clientUrl],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // WebSocket adapter (Socket.IO)
  app.useWebSocketAdapter(new IoAdapter(app));

  // Global API prefix
  app.setGlobalPrefix('api');

  await app.listen(port);
  console.log(`🚀 ShiftSync server running on http://localhost:${port}/api`);
}
bootstrap();
