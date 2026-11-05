import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createReadStream, existsSync, statSync } from 'fs';
import { resolve, sep } from 'path';

/**
 * Public, unauthenticated endpoints used by the display screens.
 * Only non-sensitive queue/counter/ticket information is exposed here.
 */
@Controller('public/file')
export class PublicFileController {
  constructor(
    @InjectModel('Queue') private queues: Model<any>,
    @InjectModel('Counter') private counters: Model<any>,
    @InjectModel('Caisse') private caisses: Model<any>,
    @InjectModel('Ticket') private tickets: Model<any>,
    @InjectModel('QueueCounter') private queueCounters: Model<any>
  ) {}

  /**
   * Public queue descriptor used by the unauthenticated POS/kiosk page.
   * Only presentation fields are exposed (no establishmentId, no credentials).
   */
  @Get(':id')
  async queueForPos(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Queue not found');
    const q = (await this.queues.findOne({ _id: id, active: true }).lean()) as any;
    if (!q) throw new NotFoundException('Queue not found');
    return {
      _id: String(q._id),
      name: q.name,
      code: q.code,
      prefix: q.prefix || '',
      active: q.active !== false,
      display: q.display || {}
    };
  }

  /** Last ticket number generated today for this queue (public POS display). */
  @Get(':id/number')
  async currentNumberForPos(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Queue not found');
    const q = (await this.queues.findOne({ _id: id, active: true }).lean()) as any;
    if (!q) throw new NotFoundException('Queue not found');

    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Douala',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    const c = (await this.queueCounters
      .findOne({ establishmentId: q.establishmentId, queueId: q._id, operationalDate: date })
      .lean()) as any;
    const n = c?.value || 0;

    return {
      queueId: String(q._id),
      queueName: q.name,
      currentNumber: n,
      displayNumber: `${q.prefix || ''}${String(n).padStart(3, '0')}`,
      operationalDate: date
    };
  }

  @Get(':id/counters')
  async countersForFile(@Param('id') id: string) {
    const q = (await this.queues.findOne({ _id: id, active: true }).lean()) as any;
    if (!q) throw new NotFoundException('Queue not found');

    const counters = (await this.counters
      .find({ queueIds: q._id, active: true })
      .lean()) as any[];

    const caisseRows = await this.caisses.find({ establishmentId: q.establishmentId, queueId: q._id, active: true }).lean();
    const caisseIds = caisseRows.map((c: any) => c._id);

    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Douala',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    const counterIds = counters.map((c) => c._id).concat(caisseIds);

    // One aggregation instead of one query per counter: the display polls this
    // endpoint every couple of seconds, so N+1 queries must be avoided.
    const active = counterIds.length
      ? await this.tickets.aggregate([
          {
            $match: {
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

    return {
      queue: q,
      counters: result,
      caisses: caisseRows.map((c: any) => {
        const ticket = byCounter.get(String(c._id));
        return {
          _id: String(c._id),
          name: c.name,
          username: c.username,
          active: c.active !== false,
          online: c.online !== false,
          pausedByCashier: c.pausedByCashier !== false,
          currentTicket: ticket
            ? { id: String(ticket._id), displayNumber: ticket.displayNumber, status: ticket.status, recalledAt: ticket.recalledAt || null, createdAt: ticket.createdAt || null, calledAt: ticket.calledAt || null, servingAt: ticket.servingAt || null, completedAt: ticket.completedAt || null }
            : null
        };
      })
    };
  }
}

@Controller('queues')
export class PublicQueuesController {
  constructor(
    @InjectModel('Queue') private queues: Model<any>,
    @InjectModel('Counter') private counters: Model<any>
  ) {}

  @Get()
  async list() {
    return await this.queues.find({ active: true }).lean();
  }

  @Get('counters')
  async listCounters() {
    return await this.counters.find({ active: true }).lean();
  }
}

/**
 * Serves uploaded display media (images/videos) to unauthenticated display
 * screens. Files are immutable and addressed by their MediaAsset id.
 */
@Controller('public/media')
export class PublicMediaController {
  constructor(@InjectModel('MediaAsset') private media: Model<any>) {}

  @Get(':id')
  async serve(@Param('id') id: string, @Res() res: any) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Media not found');

    const asset = (await this.media.findOne({ _id: id, status: 'ready' }).lean()) as any;
    if (!asset || !asset.storageName) throw new NotFoundException('Media not found');

    const root = resolve(process.env.MEDIA_ROOT || './media');
    const filePath = resolve(root, asset.storageName);
    if (!filePath.startsWith(root + sep)) throw new NotFoundException('Media not found');
    if (!existsSync(filePath)) throw new NotFoundException('Media not found');

    const size = statSync(filePath).size;

    res.status(200);
    res.setHeader('Content-Type', asset.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', size);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(asset.name || 'media')}"`
    );

    // Stream the file explicitly: res.sendFile() left the response truncated
    // (headers sent, zero bytes) in the Nest/Express integration.
    const stream = createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) res.status(404).end();
      else res.destroy();
    });
    stream.pipe(res);
  }
}
