import { Module } from '@nestjs/common';
import { CountersController } from './counters.controller';
import { CountersService } from './counters.service';
import { DomainModule } from '../domain/domain.module';
import { TicketsModule } from '../tickets/tickets.module';
import { SessionGuard, RolesGuard, Roles } from '../../common/security';

@Module({
  imports: [DomainModule, TicketsModule],
  controllers: [CountersController],
  providers: [CountersService, SessionGuard, RolesGuard],
})
export class CountersModule {}
