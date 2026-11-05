import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: 'users.component.html',
  styleUrls: ['users.component.scss']
})
export class UsersComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  rows: any[] = [];
  page = 1;
  pageSize = 20;
  loading = true;
  error = '';
  message = '';

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true; this.error = '';
    this.api.list('users').subscribe({
      next: (x: any[]) => { this.rows = Array.isArray(x) ? x : []; this.page = 1; this.loading = false; },
      error: () => { this.loading = false; this.error = 'Impossible de charger les utilisateurs.'; }
    });
  }

  get paginated(): any[] {
    const start = (this.page - 1) * this.pageSize;
    return this.rows.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.rows.length / this.pageSize));
  }

  go(p: number): void { if (p >= 1 && p <= this.totalPages) this.page = p; }

  roleLabel(role: string): string {
    const m: Record<string,string> = {
      super_admin: 'Super admin',
      admin: 'Admin',
      supervisor: 'Superviseur',
      technician: 'Technicien',
      agent: 'Agent',
      display: 'Écran',
      kiosk: 'Kiosque'
    };
    return m[role] || role;
  }

  roleClass(role: string): string {
    const c: Record<string,string> = {
      super_admin: 'badge--purple', admin: 'badge--indigo', supervisor: 'badge--blue',
      technician: 'badge--teal', agent: 'badge--amber', display: 'badge--slate', kiosk: 'badge--gray'
    };
    return c[role] || 'badge--gray';
  }
  trackById(_index: number, item: any): string {
    return String(item?._id || '');
  }
}
