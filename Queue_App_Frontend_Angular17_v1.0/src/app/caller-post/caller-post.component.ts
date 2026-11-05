import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: 'caller-post.component.html',
  styleUrls: ['caller-post.component.scss']
})
export class CallerPostComponent {
  router = inject(Router);
  http = inject(HttpClient);

  username = '';
  password = '';
  logged = !!localStorage.getItem('queue_token_caller');
  error = '';
  current: any = {};

  /** URL de base effective : override local sinon derivee de l'hote. */
  private apiBase(): string {
    const stored = localStorage.getItem('queue_api');
    if (stored) return stored;
    const host = window.location.hostname || 'localhost';
    return `http://${host}:3000/api`;
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('queue_token_caller');
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  login() {
    this.http.post<any>(`${this.apiBase()}/auth/login`, {
      username: this.username, password: this.password
    }).subscribe({
      next: (r) => {
        localStorage.setItem('queue_token_caller', r.accessToken);
        this.logged = true;
        this.loadCurrent();
      },
      error: (e) => (this.error = e.error?.message || 'Échec')
    });
  }

  loadCurrent() {
    this.http.get<any>(`${this.apiBase()}/file/1/number`, { headers: this.authHeaders() })
      .subscribe((x) => (this.current = x || {}));
  }

  next() {
    this.http.post<any>(`${this.apiBase()}/file/1/next`, {}, { headers: this.authHeaders() }).subscribe();
  }

  recall() { /* TODO */ console.log('recall'); }
  pause() { /* TODO */ console.log('pause'); }

  logout() {
    localStorage.removeItem('queue_token_caller');
    this.logged = false;
    this.router.navigateByUrl('/');
  }
}