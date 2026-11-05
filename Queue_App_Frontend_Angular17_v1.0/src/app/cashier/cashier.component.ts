import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../api.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  templateUrl: 'cashier.component.html',
  styleUrls: ['cashier.component.scss']
})
export class CashierComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private router = inject(Router);

  showModal = true;
  modalMode: 'kiosk' | 'logout' = 'kiosk';
  counterName = 'Caisse';
  queueName = '—';
  currentTicket: any = null;
  waitingTime = '--:--:--';
  processingTime = '--:--:--';
  queueId = '';
  counterId = '';
  paused = false;

  private createdAtMs: number | null = null;
  private calledAtMs: number | null = null;
  private serviceStartMs: number | null = null;
  private completedAtMs: number | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;

  dismissModal(): void { this.showModal = false; }
  confirmKiosk(): void { this.showModal = false; const el = document.documentElement as any; if (el.requestFullscreen) el.requestFullscreen(); else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen(); }

  logout() { this.modalMode = 'logout'; this.showModal = true; }
  cancelLogout() { this.showModal = false; }
  confirmLogout() {
    this.showModal = false;
    this.api.caisseOffline().subscribe({ next: () => this.finishLogout(), error: () => this.finishLogout() });
    setTimeout(() => this.finishLogout(), 1500);
  }

  private finished = false;
  private finishLogout(): void {
    if (this.finished) return;
    this.finished = true;
    localStorage.removeItem('queue_token');
    localStorage.removeItem('queue_user');
    this.router.navigateByUrl('/login');
  }

  ngOnInit(): void {
    const raw = localStorage.getItem('queue_user');
    if (raw) {
      try {
        const u = JSON.parse(raw);
        this.counterId = u.counterId || u.id || '';
        this.queueId = u.queueId || '';
        this.counterName = u.displayName || u.name || 'Caisse';
      } catch { /* ignore */ }
    }
    if (!this.counterId || !this.queueId) {
      this.api.me().subscribe({
        next: (r: any) => {
          if (r.user) {
            this.counterId = r.user.counterId || r.user.id || '';
            this.queueId = r.user.queueId || '';
            this.counterName = r.user.displayName || 'Caisse';
            if (this.queueId) localStorage.setItem('queue_user', JSON.stringify(r.user));
          }
        }, error: () => {}
      });
    }
    if (this.queueId) {
      this.api.getQueue(this.queueId).subscribe({
        next: (q: any) => { this.queueName = q?.name || q?.code || '—'; },
        error: () => {}
      });
    }
    this.api.caisseOnline().subscribe({ next: () => {}, error: () => {} });
    this.api.myCurrentTicket().subscribe({
      next: (t: any) => { if (t && t.displayNumber) this.applyTicket(t); },
      error: () => {}
    });
    this.startTicker();
  }

  ngOnDestroy(): void {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  callNext() {
    this.api.callNext(this.queueId, this.counterId).subscribe((t: any) => {
      this.applyTicket(t);
    });
  }

  recall() {
    if (!this.currentTicket) return;
    const id = this.currentTicket.id || this.currentTicket.displayNumber || this.currentTicket._id;
    this.api.recallTicket(id).subscribe({ next: () => {}, error: () => {} });
  }

  pause() {
    const newPaused = !this.paused;
    this.api.caissePause(newPaused).subscribe({
      next: () => { this.paused = newPaused; },
      error: () => {}
    });
  }

  applyTicket(t: any) {
    this.currentTicket = t || null;
    this.createdAtMs = t?.createdAt ? new Date(t.createdAt).getTime() : null;
    this.calledAtMs = t?.calledAt ? new Date(t.calledAt).getTime() : null;
    this.serviceStartMs = t?.servingAt ? new Date(t.servingAt).getTime() : null;
    this.completedAtMs = t?.completedAt ? new Date(t.completedAt).getTime() : null;
    if (this.currentTicket) {
      this.waitingTime = '--:--:--';
      this.processingTime = '--:--:--';
    }
    this.tick();
  }

  private tick() {
    if (!this.currentTicket) {
      this.waitingTime = '--:--:--';
      this.processingTime = '--:--:--';
      return;
    }
    const now = Date.now();
    const calledTime = this.calledAtMs ?? this.createdAtMs;
    this.waitingTime = calledTime != null ? this.formatDuration(calledTime - (this.createdAtMs ?? calledTime)) : '--:--:--';
    const serviceStart = this.serviceStartMs ?? this.calledAtMs ?? this.createdAtMs;
    if (serviceStart != null) {
      const end = this.completedAtMs ?? now;
      this.processingTime = this.formatDuration(end - serviceStart);
    } else if (!this.currentTicket) {
      this.processingTime = '--:--:--';
    }
  }

  private formatDuration(ms: number): string {
    if (ms < 0) ms = 0;
    const totalSec = Math.floor(ms / 1000);
    const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  private startTicker(): void {
    if (this.ticker) return;
    this.ticker = setInterval(() => this.tick(), 1000);
  }
}
