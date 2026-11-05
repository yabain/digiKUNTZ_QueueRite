import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api');

  const corsRaw = (config.get<string>('CORS_ORIGINS') || 'http://localhost:4200,http://localhost:8100')
    .split(',').map((s) => s.trim());
  // Si "*" figure dans la liste, autoriser toutes les origines (origine réfléchie),
  // compatible avec credentials (l'app utilise un token bearer, pas de cookies).
  app.enableCors({ origin: corsRaw.includes('*') ? true : corsRaw, credentials: true });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  await app.listen(config.get<number>('PORT') || 3000, '0.0.0.0');
}
bootstrap();