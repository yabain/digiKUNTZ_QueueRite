import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: 'file-pos.component.html',
  styleUrls: ['file-pos.component.scss']
})
export class FilePOSComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);

  fileId = '';
  queue: any = null;
  displayNumber = '---';
  loading = true;
  error = '';
  generating = false;
  logoBroken = false;

  ngOnInit(): void {
    this.fileId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.fileId) {
      this.error = 'Identifiant de file manquant.';
      this.loading = false;
      return;
    }
    this.load();
    // Plein écran si demandé dans les paramètres (kiosk : déjà en plein écran).
    if (localStorage.getItem('queue_fullscreen') === '1') {
      const el = document.documentElement as any;
      try {
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      } catch { /* kiosk déjà plein écran */ }
    }
  }

  /** URL de base de l'API : override local sinon derivee de l'hote (marche en reseau). */
  private apiBase(): string {
    const stored = localStorage.getItem('queue_api');
    if (stored) return stored;
    const host = window.location.hostname || 'localhost';
    return `http://${host}:3000/api`;
  }

  load(): void {
    this.loading = true;
    const base = this.apiBase();
    this.http.get<any>(`${base}/public/file/${this.fileId}`).subscribe({
      next: (q: any) => {
        this.queue = q || null;
        this.loadCurrentNumber();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'Impossible de charger la file.';
      }
    });
  }

  loadCurrentNumber(): void {
    const base = this.apiBase();
    this.http.get<any>(`${base}/public/file/${this.fileId}/number`).subscribe({
      next: (d: any) => { this.displayNumber = d?.displayNumber || '---'; },
      error: () => {}
    });
  }

  /** Durée de blocage du bouton après clic (ms). */
  private readonly lockMs = 5000;
  private lockTimer: ReturnType<typeof setTimeout> | null = null;

  /** Contenu du ticket à imprimer (rempli à la génération). */
  printData: { number: string; dateTime: string; queueName: string } | null = null;

  generateTicket(): void {
    if (this.generating) return;
    this.generating = true;
    this.error = '';

    // Relâche le bouton après 5 s, indépendamment du réseau.
    if (this.lockTimer) clearTimeout(this.lockTimer);
    this.lockTimer = setTimeout(() => { this.generating = false; }, this.lockMs);

    const base = this.apiBase();
    const key = 'pos-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    this.http.post<any>(`${base}/public/file/${this.fileId}/tickets`, { source: 'kiosk' }, {
      headers: { 'Idempotency-Key': key, 'Content-Type': 'application/json' }
    }).subscribe({
      next: (t: any) => {
        this.displayNumber = t?.displayNumber || '---';
        this.prepareAndPrint(this.displayNumber);
      },
      error: (e: any) => {
        this.error = e?.error?.message || 'Échec de génération du ticket.';
      }
    });
  }

  /** Remplit la zone imprimable puis lance l'impression silencieuse. */
  private prepareAndPrint(number: string): void {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
      `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    this.printData = { number, dateTime, queueName: this.queue?.name || '' };

    // Laisse Angular peindre la zone avant d'imprimer.
    setTimeout(() => {
      window.print();
      // Après impression, on peut libérer la zone (l'écran reste propre).
      this.printData = null;
    }, 60);
  }

  ngOnDestroy(): void {
    if (this.lockTimer) clearTimeout(this.lockTimer);
  }

  get primaryColor(): string {
    return this.queue?.display?.primaryColor || '#f58225';
  }

  get logoUrl(): string {
    if (this.logoBroken) return '';
    const assetId = this.queue?.display?.logo?.assetId || this.queue?.display?.logo;
    if (!assetId) return '';
    return `${this.apiBase()}/public/media/${assetId}`;
  }

  /** Hide the image when the referenced media asset was deleted server-side. */
  onLogoError(): void {
    this.logoBroken = true;
  }

  showSettings = false;
  apiUrl = '';

  openSettings(): void {
    this.apiUrl = this.apiBase();
    this.showSettings = true;
  }
  closeSettings(): void { this.showSettings = false; }
  saveApiUrl(): void {
    localStorage.setItem('queue_api', this.apiUrl?.trim() || this.apiBase());
    this.closeSettings();
  }

  goHome(): void {
    this.router.navigateByUrl('/');
  }
}
