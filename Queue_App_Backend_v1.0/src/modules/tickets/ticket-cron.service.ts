import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class TicketCronService {
  private readonly logger = new Logger(TicketCronService.name);
  constructor(@InjectModel('Ticket') private tickets: Model<any>) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cancelOldTickets() {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const result = await this.tickets.updateMany(
      { operationalDate: { $lt: today }, status: 'waiting', calledAt: null },
      { $set: { status: 'cancelled' } }
    );
    if (result.modifiedCount > 0) {
      this.logger.log(`Cancelled ${result.modifiedCount} old tickets before ${today}`);
    }
  }
}
