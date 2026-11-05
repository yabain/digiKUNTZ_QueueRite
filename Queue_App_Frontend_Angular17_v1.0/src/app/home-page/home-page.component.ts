import { Component, inject } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: 'home-page.component.html',
  styleUrls: ['home-page.component.scss']
})
export class HomePageComponent {
  router = inject(Router);
  http = inject(HttpClient);

  showModal = false;
  showSettings = false;
  apiUrl = '';
  modalType = 'pos';
  files: any[] = [];

  // Identical copies are rendered so the marquee loops seamlessly and
  // always fills the viewport (even on 4K screens).
  readonly partnerCopies = [0, 1, 2, 3, 4, 5, 6];
  readonly partnerLogos = [
    { src: 'assets/img/partners/logo_eneo.png', alt: 'Eneo' },
    { src: 'assets/img/partners/logo_gcloud.png', alt: 'GCloud' },
    { src: 'assets/img/partners/logo_yabain.webp', alt: 'Yaba-In' },
    { src: 'assets/img/partners/logo_udm.webp', alt: 'UdM' },
    { src: 'assets/img/partners/logo_racciram.png', alt: 'RACCIRAM' },
    { src: 'assets/img/partners/logo_mountains_tech.webp', alt: 'Mountains-Tech' },
    { src: 'assets/img/partners/logo_clemios.png', alt: 'Clemios' },
    { src: 'assets/img/partners/dk_payments_logo.png', alt: 'DK Payments' },
    { src: 'assets/img/partners/logo_sdkgames.png', alt: 'SDK Games' }
  ];

  /** URL de base effective : override local, sinon derivee de l'hote. */
  private apiBase(): string {
    const stored = localStorage.getItem('queue_api');
    if (stored) return stored;
    const host = window.location.hostname || 'localhost';
    return `http://${host}:3000/api`;
  }

  openModal(type: string) {
    this.modalType = type;
    this.showModal = true;
    this.http.get<any[]>(`${this.apiBase()}/queues`).subscribe((x) => (this.files = x || []));
  }

  selectFile(f: any) {
    this.showModal = false;
    if (this.modalType === 'pos') {
      this.router.navigateByUrl('/file/' + f._id + '/pos');
    } else {
      this.router.navigateByUrl('/displays/' + f._id);
    }
  }

  openSettings(): void {
    this.apiUrl = this.apiBase();
    this.showSettings = true;
  }
  closeSettings(): void { this.showSettings = false; }
  saveApiUrl(): void {
    localStorage.setItem('queue_api', this.apiUrl?.trim() || this.apiBase());
    this.closeSettings();
  }
}
