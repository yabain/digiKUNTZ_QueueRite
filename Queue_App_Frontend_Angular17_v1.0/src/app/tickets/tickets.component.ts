import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../api.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: 'tickets.component.html',
  styleUrls: ['tickets.component.scss']
})
export class TicketsComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  allRows: any[] = [];
  page = 1;
  pageSize = 20;
  loading = true;
  error = '';

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true; this.error = '';
    this.api.tickets().subscribe({
      next: (x: any[]) => { this.allRows = Array.isArray(x) ? x : []; this.page = 1; this.loading = false; },
      error: () => { this.loading = false; this.error = 'Impossible de charger les tickets.'; }
    });
  }

  get paginated(): any[] {
    const start = (this.page - 1) * this.pageSize;
    return this.allRows.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.allRows.length / this.pageSize));
  }

  go(p: number): void { if (p >= 1 && p <= this.totalPages) this.page = p; }

  statusLabel(s: string): string {
    const m: Record<string,string> = {
      waiting: 'En attente',
      called: 'Appelé',
      serving: 'En service',
      completed: 'Terminé',
      skipped: 'Ignoré',
      recalled: 'Rappelé',
      cancelled: 'Annulé'
    };
    return m[s] || s;
  }

  trackById(_index: number, item: any): string { return String(item?._id || ''); }

  statusClass(s: string): string {
    const c: Record<string,string> = {
      waiting: 'badge--wait',
      called: 'badge--call',
      serving: 'badge--teal',
      completed: 'badge--done',
      skipped: 'badge--gray',
      recalled: 'badge--amber',
      cancelled: 'badge--cancel'
    };
    return c[s] || 'badge--gray';
  }
}
