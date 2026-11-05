import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../api.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: 'queue-detail.component.html',
  styleUrls: ['queue-detail.component.scss']
})
export class QueueDetailComponent {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  queue: any = {};
  counters: any[] = [];
  stats: any[] = [];
  tab = '24h';

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.api.list('queues').subscribe((queues) => {
      this.queue = queues.find((queue: any) => queue._id === id) || {};
    });
    this.counters = [{ name: 'Caisse 1', username: 'caisse1', password: '' }];
    this.stats = [{ date: '2026-11-02', tickets: 42 }];
  }

  openCaller(counter: any): void {
    localStorage.setItem('queue_caller_id', counter.username);
    this.router.navigateByUrl('/caller');
  }

  editDisplay(): void {
    const id = this.queue?._id || this.route.snapshot.paramMap.get('id');
    if (id) this.router.navigate(['/queues', id, 'edit']);
  }
}
