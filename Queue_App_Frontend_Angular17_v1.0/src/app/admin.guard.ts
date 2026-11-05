import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { CanActivateFn } from '@angular/router';
import { ApiService } from './api.service';

export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const raw = localStorage.getItem('queue_user');
  const user = raw ? JSON.parse(raw) : null;
  if (!user) {
    router.navigateByUrl('/');
    return false;
  }
  if (user.role === 'agent') {
    router.navigateByUrl('/caisse');
    return false;
  }
  if (!['super_admin', 'admin', 'supervisor', 'technician'].includes(user.role || '')) {
    router.navigateByUrl('/');
    return false;
  }
  return true;
};
