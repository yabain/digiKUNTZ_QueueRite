import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { hash, compare } from 'bcryptjs';
import { CaisseDto, UpdateCaisseDto } from './counters.dto';

/**
 * Service for managing caisse (caisse) configuration.
 * Each caisse belongs to a Queue (file) and is scoped to an establishment.
 */
@Injectable()
export class CountersService {
  constructor(
    @InjectModel('Caisse') private readonly caisseModel: Model<any>,
    @InjectModel('Queue') private readonly queueModel: Model<any>,
    @InjectModel('Ticket') private readonly ticketModel: Model<any>,
  ) {}

  private today(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Douala',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  /**
   * Toggle a cashier-pause flag on the caisse card. The display screen colors
   * its ticket card blue (broken-primary) while paused, so the operator knows
   * the service is waiting on someone else to resume.
   */
  async setPause(id: string, establishmentId: string, paused: boolean) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Caisse not found');
    const caisse: any = await this.caisseModel
      .findOneAndUpdate({ _id: id, establishmentId }, { $set: { pausedByCashier: paused, lastSeenAt: paused ? null : new Date() } }, { new: true })
      .lean();
    if (!caisse) throw new NotFoundException('Caisse not found');
    return { id: String(caisse._id), paused: caisse.pausedByCashier === paused };
  }

  /**
   * Mark a caisse as online/offline. The display screen polls the public
   * counters endpoint and uses this flag to color the card (red when offline).
   */
  async setOnline(id: string, establishmentId: string, online: boolean) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Caisse not found');
    const caisse: any = await this.caisseModel
      .findOneAndUpdate(
        { _id: id, establishmentId },
        { $set: { online, lastSeenAt: new Date() } },
        { new: true },
      )
      .lean();
    if (!caisse) throw new NotFoundException('Caisse not found');
    return { id: String(caisse._id), online: caisse.online !== false };
  }

  /**
   * Return the ticket currently assigned to this caisse so a cashier who
   * reconnects immediately sees the number they were serving before.
   */
  async getCurrentTicket(id: string, establishmentId: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Caisse not found');
    const caisse: any = await this.caisseModel.findOne({ _id: id, establishmentId }).lean();
    if (!caisse) throw new NotFoundException('Caisse not found');

    const ticket: any = await this.ticketModel
      .findOne({
        establishmentId,
        queueId: caisse.queueId,
        counterId: caisse._id,
        operationalDate: this.today(),
        status: { $in: ['called', 'serving'] },
      })
      .sort({ calledAt: -1, _id: -1 })
      .lean();

    return ticket
      ? {
          id: String(ticket._id),
          displayNumber: ticket.displayNumber,
          status: ticket.status,
          createdAt: ticket.createdAt || null,
          calledAt: ticket.calledAt || null,
          servingAt: ticket.servingAt || null,
          completedAt: ticket.completedAt || null,
          waitingSeconds: this.secondsBetween(ticket.createdAt, ticket.calledAt),
          processingSeconds: this.secondsBetween(
            ticket.servingAt || ticket.calledAt,
            ticket.completedAt || new Date(),
          ),
        }
      : null;
  }

  /** Whole seconds between two dates, or null when either date is missing. */
  private secondsBetween(from: any, to: any): number | null {
    if (!from || !to) return null;
    const a = new Date(from).getTime();
    const b = new Date(to).getTime();
    if (Number.isNaN(a) || Number.isNaN(b)) return null;
    return Math.max(0, Math.round((b - a) / 1000));
  }

  /** Never expose password hashes to API clients. */
  private sanitize(caisse: any): any {
    if (!caisse) return caisse;
    const obj = typeof caisse.toObject === 'function' ? caisse.toObject() : { ...caisse };
    delete obj.password;
    return obj;
  }

  async listCaises(establishmentId: string, queueId?: string) {
    const query: any = { establishmentId };
    if (queueId) {
      if (!Types.ObjectId.isValid(queueId)) throw new NotFoundException('Queue not found');
      query.queueId = queueId;
    }
    const rows = await this.caisseModel.find(query).sort({ name: 1 }).lean();
    return rows.map((row: any) => this.sanitize(row));
  }

  async getCaisse(id: string, establishmentId: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Caisse not found');
    const caisse = await this.caisseModel.findOne({ _id: id, establishmentId }).lean();
    if (!caisse) throw new NotFoundException('Caisse not found');
    return this.sanitize(caisse);
  }

  async createCaisse(establishmentId: string, dto: CaisseDto) {
    if (!Types.ObjectId.isValid(dto.queueId)) {
      throw new NotFoundException('Queue not found');
    }

    const queue = await this.queueModel.findById(dto.queueId).exec();
    if (!queue) throw new NotFoundException('Queue not found');
    if (String(queue.establishmentId) !== establishmentId) {
      throw new NotFoundException('Queue not found');
    }

    const existing = await this.caisseModel.findOne({
      establishmentId,
      username: dto.username,
    });
    if (existing) throw new ConflictException('Un caisse avec ce login existe déjà.');

    const caisse = new this.caisseModel({
      establishmentId,
      queueId: dto.queueId,
      name: dto.name.trim(),
      username: dto.username.trim(),
      password: await hash(dto.password || '', 10),
      active: dto.active ?? true,
    });

    const saved = await caisse.save();
    return this.sanitize(saved);
  }

  async updateCaisse(id: string, establishmentId: string, dto: UpdateCaisseDto) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Caisse not found');

    const caisse = await this.caisseModel.findOne({ _id: id, establishmentId });
    if (!caisse) throw new NotFoundException('Caisse not found');

    if (dto.queueId !== undefined && String(dto.queueId || '') !== String(caisse.queueId || '')) {
      if (!Types.ObjectId.isValid(dto.queueId)) {
        throw new NotFoundException('Queue not found');
      }
      const queue = await this.queueModel.findById(dto.queueId).exec();
      if (!queue) throw new NotFoundException('Queue not found');
      if (String(queue.establishmentId) !== establishmentId) {
        throw new NotFoundException('Queue not found');
      }
    }

    if (dto.username !== undefined && dto.username.trim() !== caisse.username) {
      const existing = await this.caisseModel.findOne({
        establishmentId,
        username: dto.username.trim(),
      });
      if (existing) throw new ConflictException('Un caisse avec ce login existe déjà.');
    }

    const update: any = {};
    if (dto.queueId !== undefined) update.queueId = dto.queueId;
    if (dto.name !== undefined) update.name = dto.name.trim();
    if (dto.username !== undefined) update.username = dto.username.trim();
    // Only re-hash when a genuinely new password is supplied; never hash a hash.
    if (dto.password !== undefined && String(dto.password).trim() !== '') {
      update.password = await hash(dto.password, 10);
    }
    if (dto.active !== undefined) update.active = dto.active;

    if (!Object.keys(update).length) throw new BadRequestException('Aucune donnée à mettre à jour.');

    const updated = await this.caisseModel
      .findOneAndUpdate({ _id: id, establishmentId }, { $set: update }, { new: true, runValidators: true })
      .lean();
    return this.sanitize(updated);
  }

  async getMyCaisse(establishmentId: string, userId: string) {
    const caisse = await this.caisseModel.findOne({ establishmentId, _id: userId }).lean();
    return this.sanitize(caisse);
  }

  async removeCaisse(id: string, establishmentId: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Caisse not found');
    const result = await this.caisseModel.deleteOne({ _id: id, establishmentId });
    if (result.deletedCount === 0) throw new NotFoundException('Caisse not found');
    return { deleted: true };
  }
}