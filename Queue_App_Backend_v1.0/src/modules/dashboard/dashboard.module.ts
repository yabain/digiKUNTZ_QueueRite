import { Module, Controller, Get, Req, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SessionGuard } from '../../common/security';
import { DomainModule } from '../domain/domain.module';
import { TicketsModule } from '../tickets/tickets.module';

const TIMEZONE = 'Africa/Douala';

function operationalDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

@Controller('dashboard')
@UseGuards(SessionGuard)
class DashboardController {
  constructor(
    @InjectModel('Queue') private queues: Model<any>,
    @InjectModel('Counter') private counters: Model<any>,
    @InjectModel('Ticket') private tickets: Model<any>
  ) {}

  @Get('stats')
  async stats(@Req() req: any) {
    const establishmentId = String(req.user.establishmentId);
    const oid = new Types.ObjectId(establishmentId);
    const date = operationalDate();

    const [
      queuesTotal,
      queuesActive,
      countersTotal,
      countersActive,
      ticketsTotal,
      ticketsToday,
      statusRows,
      averageRows,
      queueRows,
      recentTickets,
      queueDocs
    ] = await Promise.all([
      this.queues.countDocuments({ establishmentId }),
      this.queues.countDocuments({ establishmentId, active: true }),
      this.counters.countDocuments({ establishmentId }),
      this.counters.countDocuments({ establishmentId, active: true }),
      this.tickets.countDocuments({ establishmentId }),
      this.tickets.countDocuments({ establishmentId, operationalDate: date }),
      this.tickets.aggregate([
        { $match: { establishmentId: oid, operationalDate: date } },
        { $group: { _id: '$status', n: { $sum: 1 } } }
      ]),
      this.tickets.aggregate([
        { $match: { establishmentId: oid, operationalDate: date, calledAt: { $ne: null } } },
        {
          $group: {
            _id: null,
            waitMs: { $avg: { $subtract: ['$calledAt', '$createdAt'] } },
            serviceMs: {
              $avg: {
                $cond: [
                  { $and: [{ $ne: ['$completedAt', null] }, { $ne: ['$calledAt', null] }] },
                  { $subtract: ['$completedAt', '$calledAt'] },
                  null
                ]
              }
            }
          }
        }
      ]),
      this.tickets.aggregate([
        { $match: { establishmentId: oid, operationalDate: date } },
        {
          $group: {
            _id: '$queueId',
            total: { $sum: 1 },
            waiting: { $sum: { $cond: [{ $eq: ['$status', 'waiting'] }, 1, 0] } },
            called: { $sum: { $cond: [{ $eq: ['$status', 'called'] }, 1, 0] } },
            serving: { $sum: { $cond: [{ $eq: ['$status', 'serving'] }, 1, 0] } },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
          }
        }
      ]),
      this.tickets
        .find({ establishmentId })
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      this.queues.find({ establishmentId }).lean()
    ]);

    const byStatus: Record<string, number> = {};
    for (const row of statusRows) byStatus[row._id] = row.n;

    const waiting = byStatus['waiting'] || 0;
    const called = byStatus['called'] || 0;
    const serving = byStatus['serving'] || 0;
    const completed = byStatus['completed'] || 0;
    const skipped = byStatus['skipped'] || 0;
    const processed = called + serving + completed + skipped;

    const avg = averageRows[0] || {};
    const queueNames = new Map<string, any>();
    for (const q of queueDocs) queueNames.set(String(q._id), q);

    return {
      generatedAt: new Date().toISOString(),
      operationalDate: date,
      queues: { total: queuesTotal, active: queuesActive },
      counters: { total: countersTotal, active: countersActive },
      tickets: {
        total: ticketsTotal,
        today: ticketsToday,
        waiting,
        called,
        serving,
        completed,
        skipped,
        processed,
        completionRate: processed ? Math.round((completed / processed) * 100) : 0
      },
      average: {
        waitMs: Math.max(0, Math.round(avg.waitMs || 0)),
        serviceMs: Math.max(0, Math.round(avg.serviceMs || 0))
      },
      byQueue: queueRows
        .map((row) => {
          const q = queueNames.get(String(row._id));
          return {
            id: String(row._id),
            name: q?.name || 'File supprimée',
            prefix: q?.prefix || '',
            active: !!q?.active,
            total: row.total,
            waiting: row.waiting,
            called: row.called,
            serving: row.serving,
            completed: row.completed
          };
        })
        .sort((a, b) => b.total - a.total),
      recentTickets: recentTickets.map((t: any) => {
        const q = queueNames.get(String(t.queueId));
        return {
          id: String(t._id),
          displayNumber: t.displayNumber,
          queueId: String(t.queueId),
          queueName: q?.name || 'File supprimée',
          status: t.status,
          createdAt: t.createdAt,
          calledAt: t.calledAt || null,
          completedAt: t.completedAt || null
        };
      })
    };
  }
}

@Module({
  imports: [DomainModule, TicketsModule],
  controllers: [DashboardController],
  providers: [SessionGuard]
})
export class DashboardModule {}
