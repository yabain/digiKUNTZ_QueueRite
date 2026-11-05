import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: 'counter-form.component.html',
  styleUrls: ['counter-form.component.scss']
})
export class CounterFormComponent {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  queueId = '';
  name = '';
  username = '';
  password = '';
  active = true;

  saving = false;
  error = '';
  success = '';
  isCreate = false;
  loading = false;
  queues: any[] = [];

  // Validate at least one field to allow submission. The password is required
  // on creation only; on edit an empty value keeps the current password.
  get isValid(): boolean {
    const passwordOk = this.isCreate
      ? this.password.trim().length >= 4
      : this.password.trim().length === 0 || this.password.trim().length >= 4;
    return (
      !!this.queueId &&
      this.name.trim().length > 0 &&
      this.username.trim().length > 0 &&
      passwordOk
    );
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.load(id);
    else this.isCreate = true;
    this.api.list('queues').subscribe({ next: (qs: any[]) => { this.queues = Array.isArray(qs) ? qs : []; } });
  }

  load(id: string): void {
    this.api.getCounter(id).subscribe({
      next: (caisse: any) => {
        this.queueId = String(caisse?.queueId || '');
        this.name = caisse?.name || '';
        this.username = caisse?.username || '';
        // The API never returns the hash; leave the field empty to keep it.
        this.password = '';
        this.active = caisse?.active !== false;
        this.error = '';
        this.success = '';
      },
      error: (err: any) => {
        this.error = err?.error?.message || `Caisse introuvable (${err?.status}).`;
      },
    });
  }

  save(): void {
    if (!this.isValid || this.saving) return;
    this.saving = true;
    this.error = '';
    this.success = '';

    const payload: any = {
      queueId: this.queueId,
      name: this.name.trim(),
      username: this.username.trim(),
      active: this.active,
    };
    if (this.password.trim()) payload.password = this.password;

    const idParam = this.route.snapshot.paramMap.get('id');
    if (!this.isCreate && !idParam) {
      this.saving = false;
      this.error = 'Caisse introuvable.';
      return;
    }
    const request = this.isCreate
      ? this.api.createCounter(payload)
      : this.api.updateCounter(idParam as string, payload);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.success = this.isCreate ? 'Caisse créée.' : 'Enregistré.';
        // Back to the caisse list after both creation and edition.
        this.router.navigate(['/counters'], {
          queryParams: { saved: this.isCreate ? 'created' : 'updated' },
        });
      },
      error: (err: any) => {
        this.saving = false;
        if (err?.status === 401) {
          this.router.navigateByUrl('/login');
          return;
        }
        this.error = err?.error?.message || 'Impossible de sauvegarder la caisse.';
      },
    });
  }

  cancel(): void {
    this.router.navigateByUrl('/counters');
  }
}
