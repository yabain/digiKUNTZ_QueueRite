import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../api.service';

@Component({ standalone: true, imports: [CommonModule, FormsModule], templateUrl: 'login.component.html', styleUrls: ['login.component.scss'] })
export class LoginComponent implements OnInit {
  api = inject(ApiService);
  router = inject(Router);
  saving = false;
  username = '';
  password = '';
  error = '';

  ngOnInit(): void {
    const token = localStorage.getItem('queue_token');
    if (token) {
      this.api.me().subscribe({
        next: () => this.router.navigateByUrl('/dashboard'),
        error: () => {}
      });
    }
    const caller = localStorage.getItem('queue_token_caller');
    if (caller && !token) {
      // Session caisse active : rester sur login si pas d'entrée directe,
      // mais on pourrait rediriger vers /caisse si nécessaire.
    }
  }

  submit(): void {
    this.saving = true;
    this.error = '';
    this.api.login(this.username, this.password).subscribe({
      next: (r: any) => {
        localStorage.setItem('queue_token', r.accessToken);
        localStorage.setItem('queue_user', JSON.stringify(r.user));
        if (r.user?.role === 'agent') {
          this.router.navigateByUrl('/caisse');
        } else {
          this.router.navigateByUrl('/dashboard');
        }
      },
      error: (e: any) => {
        this.error = e?.error?.message || 'Connexion impossible';
      }
    });
  }

  navigateByUrl(route: string){
    this.router.navigateByUrl(route);
  }
}
