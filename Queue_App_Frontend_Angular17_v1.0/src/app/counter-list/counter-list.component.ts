import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../api.service';

interface CaisseItem {
  _id: string;
  queueId: string;
  name: string;
  username: string;
  password: string;
  active: boolean;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: 'counter-list.component.html',
  styleUrls: ['counter-list.component.scss']
})
export class CounterListComponent {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  counters: CaisseItem[] = [];
  queues: any[] = [];
  loading = true;
  error = '';
  message = '';

  constructor() {}

  ngOnInit(): void {
    const saved = this.route.snapshot.queryParamMap.get('saved');
    if (saved === 'created') this.message = 'Caisse créée.';
    else if (saved === 'updated') this.message = 'Caisse enregistrée.';
    this.load();
  }

  load(): void {
    this.loading = true; this.error = '';
    this.api.list('queues').subscribe({
      next: (qs: any[]) => { this.queues = Array.isArray(qs) ? qs : []; },
      error: () => {}
    });
    this.api.listCounters({}).subscribe({
      next: (cs: any[]) => { this.counters = Array.isArray(cs) ? cs : []; this.loading = false; },
      error: () => { this.loading = false; this.error = 'Impossible de charger les caisses.'; }
    });
  }

  open(c: CaisseItem): void {
    this.router.navigate(['/counters', c._id, 'edit']);
  }

  edit(c: CaisseItem): void {
    this.router.navigate(['/counters', c._id, 'edit']);
  }

  toggle(c: CaisseItem): void {
    const active = !c.active;
    this.api.updateCounter(c._id, { active }).subscribe({
      next: () => {
        c.active = active;
        this.message = active ? 'Caisse activée.' : 'Caisse désactivée.';
      },
      error: () => this.message = 'Impossible de modifier l’état de la caisse.',
    });
  }

  remove(c: CaisseItem): void {
    if (!confirm(`Supprimer la caisse "${c.username}" ?`)) return;
    this.api.removeCounter(c._id).subscribe({
      next: () => {
        const idx = this.counters.indexOf(c);
        if (idx >= 0) this.counters.splice(idx, 1);
        this.message = 'Caisse supprimée.';
      },
      error: (e) => this.message = e?.error?.message || 'Impossible de supprimer la caisse.',
    });
  }

  queueName(c: CaisseItem): string {
    const q = this.queues.find((item: any) => String(item._id || item.id) === String(c.queueId || ''));
    return q ? String(q.name || q.code || '—') : '—';
  }

  trackById(_index: number, item: CaisseItem): string {
    return String(item._id || '');
  }
}
