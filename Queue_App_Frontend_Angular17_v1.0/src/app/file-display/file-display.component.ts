import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription, timeout } from 'rxjs';
import { ApiService } from '../api.service';

interface DisplayTicket {
  id: string;
  displayNumber: string;
  status: string;
  recalledAt?: string | null;
}

interface DisplayCounter {
  counter: any;
  currentTicket: DisplayTicket | null;
}

interface DisplaySlot {
  index: number;
  counter: any | null;
  currentTicket: DisplayTicket | null;
  number: string;
  label: string;
}

interface CaisseCard {
  _id: string;
  name: string;
  username: string;
  active: boolean;
  online?: boolean;
  pausedByCashier?: boolean;
  currentTicket?: { id: string; displayNumber: string; status: string } | null;
}

interface DisplayMedia {
  url: string;
  type: 'image' | 'video';
  name?: string;
}

const DEFAULT_MEDIA = 'assets/img/home_bg.png';
const FALLBACK_MEDIA: DisplayMedia = { url: DEFAULT_MEDIA, type: 'image', name: 'QueueRite' };
const DEFAULT_MESSAGES = [
  'Bienvenue à QueueRite',
  'Merci de patienter, vous serez appelé bientôt',
  'Welcome to QueueRite — Please wait to be called'
];
const IMAGE_DURATION = 15000;

/**
 * Public full-screen display for one queue.
 *
 * The screen mirrors the QueueRite display template and refreshes itself by
 * polling the public counters endpoint (the display has no authenticated
 * session, so a plain LAN poll is the simplest reliable real-time transport).
 *
 * The queue's `display` configuration (colors, messages, separator and up to
 * three media files) is delivered by the same public endpoint, so no extra
 * request is required.
 */
@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  selector: 'queue-file-display',
  templateUrl: 'file-display.component.html',
  styleUrls: ['file-display.component.scss']
})
export class FileDisplayComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private document = inject(DOCUMENT);

  readonly tickerCopies = [0, 1, 2, 3, 4, 5, 6, 7];

  queueId = '';
  queue: any = null;
  counters: DisplayCounter[] = [];
  caisses: CaisseCard[] = [];
  slots: DisplaySlot[] = [];
  rowCount = 3;
  notFound = false;

  primaryColor = '#91cc00';
  secondaryColor = '#eeeeee';
  messageColor: 'black' | 'white' = 'black';
  messages: string[] = [...DEFAULT_MESSAGES];
  separator = '•';
  mediaItems: DisplayMedia[] = [FALLBACK_MEDIA];
  activeMediaIndex = 0;
  clock = '';

  private pollTimer?: ReturnType<typeof setInterval>;
  private clockTimer?: ReturnType<typeof setInterval>;
  private mediaTimer?: ReturnType<typeof setTimeout>;
  private routeSub?: Subscription;
  private loading = false;
  private lastCalledNumber: string | null = null;
  private announcedTickets = new Set<string>();
  private lastRecallByCaisse = new Map<string, string>();
  private firstLoad = true;
  private mediaSignature = '';
  private messageSignature = '';
  private queryMedia: string | null = null;
  private queryMessages: string[] | null = null;
  private querySeparator: string | null = null;
  logoBroken = false;
  showKioskPrompt = true;

  ngOnInit(): void {
    this.document.documentElement.classList.add('display-fullscreen');
    this.document.body.classList.add('display-fullscreen');
    this.updateClock();
    this.clockTimer = setInterval(() => this.updateClock(), 1000);

    this.routeSub = this.route.paramMap.subscribe((params) => {
      const id = params.get('id') || '';
      this.queueId = id;
      this.queue = null;
      this.counters = [];
      this.caisses = [];
      this.announcedTickets.clear();
      this.lastRecallByCaisse.clear();
      this.firstLoad = true;
      this.notFound = false;
      this.applyQueryOptions();
      this.resetDisplayConfig();
      this.buildSlots();
      this.stopPolling();

      if (!id) return;
      this.load();
      this.pollTimer = setInterval(() => this.load(), 2000);
    });
  }

  ngOnDestroy(): void {
    this.document.documentElement.classList.remove('display-fullscreen');
    this.document.body.classList.remove('display-fullscreen');
    this.stopPolling();
    this.stopMediaTimer();
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.routeSub?.unsubscribe();
  }

  get activeMedia(): DisplayMedia {
    return this.mediaItems[this.activeMediaIndex] || this.mediaItems[0] || FALLBACK_MEDIA;
  }

  get isVideo(): boolean {
    return this.activeMedia.type === 'video';
  }

  get messageColorValue(): string {
    return this.messageColor === 'white' ? '#ffffff' : '#000000';
  }

  trackByIndex(index: number): number {
    return index;
  }

  nextMedia(): void {
    if (this.mediaItems.length <= 1) {
      this.startMediaTimer();
      return;
    }
    this.activeMediaIndex = (this.activeMediaIndex + 1) % this.mediaItems.length;
    this.startMediaTimer();
  }

  onMediaEnded(): void {
    if (this.mediaItems.length > 1) this.nextMedia();
  }

  onMediaError(): void {
    if (this.mediaItems.length > 1) {
      this.nextMedia();
      return;
    }
    if (this.activeMedia.url !== DEFAULT_MEDIA) {
      this.mediaItems = [FALLBACK_MEDIA];
      this.mediaSignature = `${FALLBACK_MEDIA.url}:${FALLBACK_MEDIA.type}`;
      this.activeMediaIndex = 0;
      this.startMediaTimer();
    }
  }

  private applyQueryOptions(): void {
    const query = this.route.snapshot.queryParamMap;
    this.queryMedia = query.get('media') || null;

    const customMessages = query.get('messages');
    this.queryMessages = customMessages
      ? customMessages
          .split('|')
          .map((message) => message.trim())
          .filter(Boolean)
      : null;

    this.querySeparator = query.get('separator') || null;
  }

  private resetDisplayConfig(): void {
    this.primaryColor = '#91cc00';
    this.secondaryColor = '#eeeeee';
    this.messageColor = 'black';
    this.separator = this.querySeparator || '•';

    const messages = this.queryMessages ?? [...DEFAULT_MESSAGES];
    this.messages = messages;
    this.messageSignature = messages.join('|');

    const media: DisplayMedia[] = this.queryMedia
      ? [{ url: this.queryMedia, type: this.detectType(this.queryMedia), name: 'Média' }]
      : [FALLBACK_MEDIA];
    this.mediaItems = media;
    this.mediaSignature = this.mediaSignatureFor(media);
    this.activeMediaIndex = 0;
    this.startMediaTimer();
  }

  private applyDisplayConfig(queue: any): void {
    const config = queue?.display && typeof queue.display === 'object' ? queue.display : null;

    if (config) {
      if (this.isHex(config.primaryColor)) this.primaryColor = config.primaryColor;
      if (this.isHex(config.secondaryColor)) this.secondaryColor = config.secondaryColor;
      this.messageColor = config.messageColor === 'white' ? 'white' : 'black';
      if (typeof config.separator === 'string' && config.separator.length <= 3) {
        this.separator = config.separator;
      }
    }

    if (this.querySeparator) this.separator = this.querySeparator;

    const configuredMessages =
      config && Array.isArray(config.messages)
        ? config.messages
            .slice(0, 50)
            .map((message: any) => String(message ?? '').trim())
            .filter(Boolean)
        : null;
    const messages = this.queryMessages ?? configuredMessages ?? [...DEFAULT_MESSAGES];
    const messageSignature = messages.join('|');
    if (messageSignature !== this.messageSignature) {
      this.messageSignature = messageSignature;
      this.messages = messages;
    }

    const configuredMedia: DisplayMedia[] =
      config && Array.isArray(config.media)
        ? config.media
            .filter((item: any) => item && item.assetId)
            .slice(0, 3)
            .map((item: any): DisplayMedia => ({
              url: this.api.mediaUrl(String(item.assetId)),
              type: item.type === 'video' ? 'video' : 'image',
              name: String(item.name || 'Média')
            }))
        : [];

    const media: DisplayMedia[] = this.queryMedia
      ? [{ url: this.queryMedia, type: this.detectType(this.queryMedia), name: 'Média' }]
      : configuredMedia.length
        ? configuredMedia
        : [FALLBACK_MEDIA];

    const mediaSignature = this.mediaSignatureFor(media);
    if (mediaSignature !== this.mediaSignature) {
      this.mediaSignature = mediaSignature;
      this.mediaItems = media;
      this.activeMediaIndex = 0;
      this.startMediaTimer();
    }
  }

  private load(): void {
    if (!this.queueId || this.loading) return;
    this.loading = true;

    this.http
      .get<{ queue: any; counters: DisplayCounter[] }>(
        `${this.api.base}/public/file/${this.queueId}/counters`
      )
      .pipe(timeout(5000))
      .subscribe({
        next: (response) => {
          this.loading = false;
          // Ignore a late response for a previous queue.
          if (!response || String(response.queue?._id) !== this.queueId) return;
          this.queue = response.queue;
          this.counters = Array.isArray(response.counters) ? response.counters : [];
          this.caisses = Array.isArray((response as any).caisses) ? (response as any).caisses.map((c: any) => ({ _id: String(c._id || ''), name: String(c.name || ''), username: String(c.username || ''), active: c.active !== false, online: c.online !== false, pausedByCashier: c.pausedByCashier !== false, currentTicket: c.currentTicket || null })) : [];
          this.notFound = false;
          this.applyDisplayConfig(response.queue);
          this.buildSlots();
          const toAnnounce: string[] = [];
          for (const c of this.caisses) {
            const ticket = c.currentTicket;
            if (!ticket?.displayNumber) continue;
            const key = `${c._id}:${ticket.id || ticket.displayNumber}`;
            const recallStamp = (ticket as any).recalledAt || '';
            const isRecall = !!recallStamp && this.lastRecallByCaisse.get(c._id) !== recallStamp;
            if (this.firstLoad) {
              this.announcedTickets.add(key);
              if (recallStamp) this.lastRecallByCaisse.set(c._id, recallStamp);
              continue;
            }
            if (isRecall) {
              this.lastRecallByCaisse.set(c._id, recallStamp);
              this.announcedTickets.add(key);
              toAnnounce.push(`Rappel numéro ${ticket.displayNumber}, ${c.name}`);
              continue;
            }
            if (this.announcedTickets.has(key)) continue;
            this.announcedTickets.add(key);
            toAnnounce.push(`Numéro ${ticket.displayNumber}, ${c.name}`);
          }
          if (this.firstLoad) this.firstLoad = false;
          if (toAnnounce.length) {
            window.speechSynthesis.cancel();
            toAnnounce.forEach((msg, i) =>
              setTimeout(() => window.speechSynthesis.speak(new SpeechSynthesisUtterance(msg)), 200 + i * 2500)
            );
          }
        },
        error: (error) => {
          this.loading = false;
          if (error?.status === 404) {
            this.notFound = true;
            this.queue = null;
            this.counters = [];
            this.stopMediaTimer();
            this.buildSlots();
          }
        }
      });
  }

  private buildSlots(): void {
    const count = Math.max(3, this.counters.length);
    this.rowCount = count;

    this.slots = Array.from({ length: count }, (_, index) => {
      const item = this.counters[index];
      const counter = item?.counter || null;
      const codeDigits = counter ? String(counter.code || '').match(/\d+/) : null;

      return {
        index,
        counter,
        currentTicket: item?.currentTicket || null,
        number: codeDigits ? String(parseInt(codeDigits[0], 10)) : String(index + 1),
        label: counter ? String(counter.name || `Caisse ${index + 1}`) : 'Free'
      };
    });
  }

  private startMediaTimer(): void {
    this.stopMediaTimer();
    if (this.mediaItems.length > 1 && this.activeMedia.type === 'image') {
      this.mediaTimer = setTimeout(() => this.nextMedia(), IMAGE_DURATION);
    }
  }

  private stopMediaTimer(): void {
    if (this.mediaTimer) {
      clearTimeout(this.mediaTimer);
      this.mediaTimer = undefined;
    }
  }

  private mediaSignatureFor(media: DisplayMedia[]): string {
    return media.map((item) => `${item.url}:${item.type}`).join('|');
  }

  private detectType(url: string): 'image' | 'video' {
    return /\.(mp4|webm|ogg|ogv|mov|m4v)(\?.*)?$/i.test(url) ? 'video' : 'image';
  }

  private isHex(value: any): boolean {
    return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  private updateClock(): void {
    this.clock = new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  get hasCalledTicket(): boolean {
    return this.counters.some((item: any) => item?.currentTicket);
  }

  get currentCalledNumber(): string | null {
    const item = this.counters.find((c: any) => c?.currentTicket);
    return item && item.currentTicket ? String(item.currentTicket.displayNumber || '---') : null;
  }

  dismissKiosk(): void { this.showKioskPrompt = false; }
  confirmKiosk(): void {
    this.showKioskPrompt = false;
    const el = document.documentElement as any;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  }

  onLogoError(): void {
    this.logoBroken = true;
  }

  get logoUrl(): string {
    if (this.logoBroken) return '';
    const assetId = this.queue?.display?.logo?.assetId || this.queue?.display?.logo;
    if (!assetId) return '';
    return `${apiBase()}/public/media/${assetId}`;
  }
}

/* URL de base effective de l'API : override local sinon derivee de l'hote. */
function apiBase(): string {
  const stored = localStorage.getItem('queue_api');
  if (stored) return stored;
  const host = window.location.hostname || 'localhost';
  return `http://${host}:3000/api`;
}
