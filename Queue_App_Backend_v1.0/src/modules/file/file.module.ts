import {
  BadRequestException,
  ConflictException,
  Module,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  UseGuards,
  NotFoundException
} from '@nestjs/common';
import { MediaController } from './media.controller';
import { PublicQueuesController, PublicFileController, PublicMediaController } from './public.controller';
import { DisplayConfigDto } from './display-config.dto';
import { QueueUpsertDto } from './queue.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Roles, RolesGuard, SessionGuard } from '../../common/security';
import { DomainModule } from '../domain/domain.module';
import { TicketsModule } from '../tickets/tickets.module';

@Controller('file')
@UseGuards(SessionGuard, RolesGuard)
class FileController {
  constructor(
    @InjectModel('Queue') private queues: Model<any>,
    @InjectModel('Counter') private counters: Model<any>,
    @InjectModel('Ticket') private tickets: Model<any>,
    @InjectModel('QueueCounter') private queueCounters: Model<any>,
    @InjectModel('MediaAsset') private media: Model<any>,
    @InjectModel('AuditLog') private audit: Model<any>
  ) {}

  @Get('queues')
  async listQueues(@Req() req: any) {
    return await this.queues.find({ establishmentId: req.user?.establishmentId || new (require('mongoose').Types.ObjectId)(), active: true }).lean();
  }
  @Get(':id')
  async getQueue(@Req() req: any, @Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Queue not found');
    const q = await this.queues
      .findOne({ _id: id, establishmentId: req.user.establishmentId })
      .lean();
    if (!q) throw new NotFoundException('Queue not found');
    return q;
  }
  @Post('queues')
  @Roles('super_admin', 'admin', 'supervisor', 'technician')
  async createQueue(@Req() req: any, @Body() dto: QueueUpsertDto) {
    const name = (dto.name || '').trim();
    const code = (dto.code || '').trim();
    if (!name || !code) {
      throw new BadRequestException('Le nom et le code sont obligatoires.');
    }
    await this.ensureUniqueCode(req.user.establishmentId, code);
    if (dto.display) {
      if (dto.display.media) await this.assertMediaOwned(dto.display.media, req.user.establishmentId);
      if (dto.display.logo) await this.assertMediaOwned([dto.display.logo], req.user.establishmentId);
    }

    const doc = await this.queues.create({
      establishmentId: req.user.establishmentId,
      name,
      code,
      description: dto.description,
      active: dto.active ?? true,
      priority: dto.priority ?? 0,
      prefix: dto.prefix ?? '',
      zone: dto.zone,
      ...(dto.display ? { display: dto.display } : {})
    });
    await this.writeAudit(req, 'create', String(doc._id));
    return doc;
  }

  @Patch(':id')
  @Roles('super_admin', 'admin', 'supervisor', 'technician')
  async updateQueue(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: QueueUpsertDto
  ) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Queue not found');

    const update: any = {};
    for (const key of ['name', 'code', 'description', 'active', 'priority', 'prefix', 'zone'] as const) {
      if (dto[key] !== undefined) update[key] = dto[key];
    }
    if (dto.display !== undefined) {
      if (dto.display.media) await this.assertMediaOwned(dto.display.media, req.user.establishmentId);
      if (dto.display.logo) await this.assertMediaOwned([dto.display.logo], req.user.establishmentId);
      update.display = dto.display;
    }
    if (!Object.keys(update).length) {
      throw new BadRequestException('Aucune donnée à mettre à jour.');
    }
    if (update.code) {
      await this.ensureUniqueCode(req.user.establishmentId, update.code, id);
    }

    const queue = await this.queues
      .findOneAndUpdate(
        { _id: id, establishmentId: req.user.establishmentId },
        { $set: update },
        { new: true, runValidators: true }
      )
      .lean();
    if (!queue) throw new NotFoundException('Queue not found');
    await this.writeAudit(req, 'update', id);
    return queue;
  }

  @Patch(':id/display')
  @Roles('super_admin', 'admin', 'supervisor', 'technician')
  async updateDisplay(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: DisplayConfigDto
  ) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Queue not found');
    const q = await this.queues
      .findOneAndUpdate(
        { _id: id, establishmentId: req.user.establishmentId },
        { $set: { display: dto } },
        { new: true, runValidators: true }
      )
      .lean();
    if (!q) throw new NotFoundException('Queue not found');
    return q;
  }
  @Get(':id/counters')
  async countersForFile(@Req() req: any, @Param('id') id: string) {
    const q = (await this.queues
      .findOne({ _id: id, establishmentId: req.user.establishmentId, active: true })
      .lean()) as any;
    if (!q) throw new NotFoundException('Queue not found');

    const establishmentId = new Types.ObjectId(req.user.establishmentId);
    const counters = (await this.counters
      .find({ establishmentId, queueIds: q._id, active: true })
      .lean()) as any[];
    const counterIds = counters.map((c) => c._id);

    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Douala',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    const active = counterIds.length
      ? await this.tickets.aggregate([
          {
            $match: {
              establishmentId,
              queueId: q._id,
              operationalDate: date,
              counterId: { $in: counterIds },
              status: { $in: ['called', 'serving'] }
            }
          },
          { $sort: { calledAt: -1, _id: -1 } },
          { $group: { _id: '$counterId', ticket: { $first: '$$ROOT' } } }
        ])
      : [];

    const byCounter = new Map<string, any>();
    for (const row of active) byCounter.set(String(row._id), row.ticket);

    const result = counters.map((counter) => {
      const ticket = byCounter.get(String(counter._id));
      return {
        counter,
        currentTicket: ticket
          ? {
              id: ticket._id,
              displayNumber: ticket.displayNumber,
              status: ticket.status
            }
          : null
      };
    });

    return { queue: q, counters: result };
  }

  @Get(':id/pos')
  async pos(@Req() req: any, @Param('id') id: string) {
    const q = await this.queues.findOne({ _id: id, establishmentId: req.user.establishmentId, active: true });
    if (!q) throw new NotFoundException('Queue not found');
    return { queue: q };
  }

  @Get(':id/number')
  async currentNumber(@Req() req: any, @Param('id') id: string) {
    const q = await this.queues.findOne({ _id: id, establishmentId: req.user.establishmentId, active: true });
    if (!q) throw new NotFoundException('Queue not found');
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const c = await this.queueCounters.findOne({ establishmentId: req.user.establishmentId, queueId: q._id, operationalDate: date });
    const n = c ? c.value : 0;
    return { queueId: String(q._id), queueName: q.name, currentNumber: n, displayNumber: q.prefix ? `${q.prefix}${String(n).padStart(3, '0')}` : String(n).padStart(3, '0'), operationalDate: date };
  }

  @Post(':id/next')
  async next(@Req() req: any, @Param('id') id: string, @Body() b: any) {
    if (!b || !b.counterId) throw new NotFoundException('counterId required');
    const q = await this.queues.findOne({ _id: id, establishmentId: req.user.establishmentId, active: true });
    if (!q) throw new NotFoundException('Queue not found');
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const session = await (this.tickets.db as any).startSession();
    let t: any;
    try {
      await session.withTransaction(async () => {
        const c = await this.queueCounters.findOneAndUpdate(
          { establishmentId: req.user.establishmentId, queueId: q._id, operationalDate: date },
          { $inc: { value: 1 } },
          { upsert: true, new: true, session }
        );
        const ticket = await this.tickets.create([
          {
            establishmentId: req.user.establishmentId,
            queueId: q._id,
            operationalDate: date,
            sequenceNumber: c.value,
            displayNumber: `${q.prefix || ''}${String(c.value).padStart(3, '0')}`,
            status: 'waiting',
            counterId: b.counterId,
            agentId: req.user.id,
            source: 'kiosk'
          }
        ], { session });
        t = ticket[0].toObject();
      });
    } finally {
      await session.endSession();
    }
    return t || { message: 'Ticket created' };
  }

  private async ensureUniqueCode(
    establishmentId: string,
    code: string,
    excludeId?: string
  ): Promise<void> {
    const query: any = { establishmentId, code };
    if (excludeId) query._id = { $ne: excludeId };
    if (await this.queues.exists(query)) {
      throw new ConflictException('Une file avec ce code existe déjà.');
    }
  }

  private async assertMediaOwned(media: any[], establishmentId: string): Promise<void> {
    if (!media?.length) return;
    const ids = [...new Set(media.map((item) => String(item.assetId)))];
    const count = await this.media.countDocuments({
      _id: { $in: ids },
      establishmentId,
      status: 'ready'
    });
    if (count !== ids.length) {
      throw new BadRequestException('Un média est introuvable ou non autorisé.');
    }
  }

  private async writeAudit(req: any, action: string, entityId: string): Promise<void> {
    try {
      await this.audit.create({
        establishmentId: req.user.establishmentId,
        actorId: req.user.id,
        action,
        entity: 'queues',
        entityId
      });
    } catch {
      // Queue writes must not fail because the audit collection is unavailable.
    }
  }
}

@Module({ imports: [DomainModule, TicketsModule], controllers: [FileController, MediaController, PublicQueuesController, PublicFileController, PublicMediaController], providers: [SessionGuard, RolesGuard] })
export class FileModule {}
