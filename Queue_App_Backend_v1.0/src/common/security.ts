import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash } from 'crypto';

export interface SessionDocument {
  userId: string;
  establishmentId: string;
  role: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  _id: string;
  __v?: number;
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@InjectModel('Session') private sessions: Model<SessionDocument>) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    if (!token) throw new UnauthorizedException('Session required');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const s = await this.sessions
      .findOne({ tokenHash, revokedAt: null, expiresAt: { $gt: new Date() } })
      .lean<SessionDocument>();
    if (!s) throw new UnauthorizedException('Session expired');
    req.user = {
      id: String(s.userId),
      role: s.role,
      establishmentId: String(s.establishmentId)
    };
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const allowed = (Reflect.getMetadata('roles', ctx.getHandler()) || []) as string[];
    if (!allowed.length) return true;
    if (!req.user || !allowed.includes(req.user.role)) throw new ForbiddenException();
    return true;
  }
}

export const Roles = (...roles: string[]) => (target: any, key?: any, descriptor?: any) => {
  Reflect.defineMetadata('roles', roles, descriptor?.value || target);
};
