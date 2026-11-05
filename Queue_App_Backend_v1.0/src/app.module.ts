import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule,ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './modules/auth/auth.module';
import { DomainModule } from './modules/domain/domain.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { HealthModule } from './modules/health/health.module';
import { FileModule } from './modules/file/file.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import {  } from './modules/reset/reset.module';
import { CountersModule } from './modules/counters/counters.module';

@Module({
imports:[
  ConfigModule.forRoot({isGlobal:true,envFilePath:['.env']}),
  ScheduleModule.forRoot(),
  MongooseModule.forRootAsync({inject:[ConfigService],useFactory:(c:ConfigService)=>({uri:c.get<string>('MONGODB_URI'),serverSelectionTimeoutMS:10000})}),
  AuthModule,
  DomainModule,
  TicketsModule,
  RealtimeModule,
  HealthModule,
  FileModule,
  DashboardModule,
  CountersModule,
],
})
export class AppModule{}