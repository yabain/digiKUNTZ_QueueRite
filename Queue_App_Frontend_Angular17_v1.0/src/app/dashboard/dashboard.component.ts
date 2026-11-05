import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../api.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: 'dashboard.component.html',
  styleUrls: ['dashboard.component.scss']
})
export class DashboardComponent {
  api = inject(ApiService);
  router = inject(Router);

  stats: any = null;
  loading = false;
  error = '';

  get connected() {
    return !!localStorage.getItem('queue_token');
  }

  ngOnInit() {
    if (this.connected) this.refresh();
  }

  refresh() {
    if (!this.connected) return;
    this.loading = true;
    this.error = '';
    this.api.dashboardStats().subscribe({
      next: (data) => {
        this.stats = data;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        if (err.status === 401) {
          localStorage.removeItem('queue_token');
          this.router.navigateByUrl('/login');
          return;
        }
        this.error = 'Impossible de charger les statistiques pour le moment.';
      }
    });
  }

  formatDuration(ms: number): string {
    if (!ms || ms < 0) return '—';
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds} s`;
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    if (minutes < 60) return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `${hours} h ${minutes % 60} min`;
  }

  percent(value: number, total: number): number {
    if (!total) return 0;
    return Math.max(4, Math.min(100, Math.round((value / total) * 100)));
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      waiting: 'En attente',
      called: 'Appelé',
      serving: 'En service',
      completed: 'Terminé',
      skipped: 'Passé'
    };
    return labels[status] || status;
  }
}
