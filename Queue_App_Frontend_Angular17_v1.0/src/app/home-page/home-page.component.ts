import { Component, inject, OnInit, OnDestroy } from '@angular/core';
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
export class HomePageComponent implements OnInit, OnDestroy {
  router = inject(Router);
  http = inject(HttpClient);

  showModal = false;
  showSettings = false;
  apiUrl = '';
  modalType = 'pos';
  files: any[] = [];

  // Redirection à l'ouverture + plein écran (réglé dans les paramètres).
  redirectOption = 'home';
  fullscreen = false;
  redirectOpen = false;
  redirectLabel = '';
  countdown = 5;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;

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

  ngOnInit(): void {
    this.loadFiles();
    this.fullscreen = localStorage.getItem('queue_fullscreen') === '1';
    this.redirectOption = localStorage.getItem('queue_redirect') || 'home';
    if (this.redirectOption !== 'home') this.beginRedirect();
  }

  ngOnDestroy(): void {
    this.stopCountdown();
  }

  loadFiles(): void {
    this.http.get<any[]>(`${this.apiBase()}/queues`).subscribe((x) => (this.files = x || []));
  }

  /** Nom d'une file à partir de son id, pour le libellé de redirection. */
  private fileName(id: string): string {
    const f = this.files.find((x) => String(x._id) === String(id));
    return f ? f.name : '';
  }

  private redirectRoute(): string | null {
    const o = this.redirectOption;
    if (o === 'login') return '/login';
    if (o.startsWith('pos:')) return `/file/${o.slice(4)}/pos`;
    if (o.startsWith('display:')) return `/displays/${o.slice(8)}`;
    return null;
  }

  private redirectMessage(): string {
    const o = this.redirectOption;
    if (o === 'login') return 'Redirection à la page de connexion';
    if (o.startsWith('pos:')) {
      const n = this.fileName(o.slice(4));
      return n ? `Redirection vers le POS de ${n}` : 'Redirection vers le POS';
    }
    if (o.startsWith('display:')) {
      const n = this.fileName(o.slice(8));
      return n ? `Redirection vers l'écran de ${n}` : "Redirection vers l'écran";
    }
    return '';
  }

  beginRedirect(): void {
    this.redirectLabel = this.redirectMessage();
    this.countdown = 5;
    this.redirectOpen = true;
    this.stopCountdown();
    this.countdownTimer = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        this.stopCountdown();
        this.goToRedirect();
      }
    }, 1000);
  }

  private stopCountdown(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  cancelRedirect(): void {
    this.stopCountdown();
    this.redirectOpen = false;
  }

  openRedirectNow(): void {
    this.stopCountdown();
    this.goToRedirect();
  }

  private goToRedirect(): void {
    const r = this.redirectRoute();
    this.redirectOpen = false;
    if (r) this.router.navigateByUrl(r);
  }

  openModal(type: string) {
    this.modalType = type;
    this.showModal = true;
    this.loadFiles();
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
    this.fullscreen = localStorage.getItem('queue_fullscreen') === '1';
    this.redirectOption = localStorage.getItem('queue_redirect') || 'home';
    this.loadFiles();
    this.showSettings = true;
  }
  closeSettings(): void { this.showSettings = false; }
  saveSettings(): void {
    localStorage.setItem('queue_api', this.apiUrl?.trim() || this.apiBase());
    localStorage.setItem('queue_fullscreen', this.fullscreen ? '1' : '0');
    localStorage.setItem('queue_redirect', this.redirectOption);
    this.closeSettings();
    // Si une redirection autre que l'accueil est choisie, on la lance.
    if (this.redirectOption !== 'home') this.beginRedirect();
  }
}
