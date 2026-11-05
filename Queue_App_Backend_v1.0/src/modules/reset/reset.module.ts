import { Module } from '@nestjs/common';
import { DomainModule } from '../domain/domain.module';
import { ResetService } from './reset.service';
@Module({ imports: [DomainModule], providers: [ResetService], exports: [ResetService] })
export class ResetModule {}
