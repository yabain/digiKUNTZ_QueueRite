import { Injectable } from '@nestjs/common';
@Injectable()
export class ResetService {
  constructor() {
    // Daily reset at midnight via simple timer (no ScheduleModule dependency)
    const now = new Date();
    const msToMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0).getTime() - now.getTime();
    setTimeout(() => this.runReset(), msToMidnight);
  }
  runReset() {
    console.log('[Reset 00h] Daily reset triggered (simplified timer)');
    // Insert logic here: reset counters, archive stats
  }
}
