import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../api.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: 'file-list.component.html',
  styleUrls: ['file-list.component.scss']
})
export class FileListComponent {
  private api = inject(ApiService);
  private router = inject(Router);

  files: any[] = [];
  loading = true;
  error = '';
  message = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.api.list('queues').subscribe({
      next: (files) => {
        this.files = Array.isArray(files) ? files : [];
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        if (error?.status === 401) {
          this.router.navigateByUrl('/login');
          return;
        }
        this.error = 'Impossible de charger les files.';
      }
    });
  }

  open(f: any): void {
    this.router.navigateByUrl('/queue/' + f._id);
  }

  edit(f: any): void {
    this.router.navigate(['/queues', f._id, 'edit']);
  }

  toggle(f: any): void {
    this.api.updateQueue(f._id, { active: !f.active }).subscribe({
      next: (updated) => {
        f.active = updated?.active ?? !f.active;
        this.flash(updated?.active ? 'File activée.' : 'File désactivée.');
      },
      error: () => this.flash('Impossible de modifier le statut.', true)
    });
  }

  remove(f: any): void {
    if (!confirm(`Supprimer la file « ${f.name} » ?`)) return;
    this.api.remove('queues', f._id).subscribe({
      next: () => {
        this.files = this.files.filter((item) => item._id !== f._id);
        this.flash('File supprimée.');
      },
      error: () => this.flash('Impossible de supprimer cette file.', true)
    });
  }

  trackById(_index: number, item: any): string {
    return item._id;
  }

  private flash(message: string, isError = false): void {
    this.message = message;
    this.error = isError ? message : '';
    setTimeout(() => {
      if (this.message === message) this.message = '';
      if (this.error === message) this.error = '';
    }, 3500);
  }

  navigateByUrl(route: string){
    window.open(route, '_blank', 'noopener,noreferrer');
  }
}
