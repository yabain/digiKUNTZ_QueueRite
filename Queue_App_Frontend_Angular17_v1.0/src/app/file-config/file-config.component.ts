import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../api.service';

interface DisplayMediaItem {
  assetId: string;
  name: string;
  mimeType: string;
  type: 'image' | 'video';
}

interface SeparatorOption {
  value: string;
  label: string;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: 'file-config.component.html',
  styleUrls: ['file-config.component.scss']
})
export class FileConfigComponent {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly maxMedia = 5;
  readonly maxFileSize = 100 * 1024 * 1024;

  readonly separatorOptions: SeparatorOption[] = [
    { value: '★', label: 'Étoile (★)' },
    { value: '•', label: 'Point centré (•)' },
    { value: '|', label: 'Barre verticale (|)' },
    { value: '-', label: 'Tiret (-)' },
    { value: '—', label: 'Tiret long (—)' },
    { value: '·', label: 'Point médian (·)' },
    { value: ' ', label: 'Espace' },
    { value: '♦', label: 'Losange (♦)' },
    { value: '→', label: 'Flèche (→)' }
  ];

  queueId = '';
  queue: any = null;
  isCreate = false;
  loading = true;
  saving = false;
  uploading = false;
  error = '';
  success = '';

  name = '';
  code = '';
  description = '';
  prefix = '';
  zone = '';
  priority = 0;
  active = true;

  primaryColor = '#91cc00';
  secondaryColor = '#eeeeee';
  messageColor: 'black' | 'white' = 'black';
  separator = '•';
  messages: string[] = [];
  media: DisplayMediaItem[] = [];
  logo: DisplayMediaItem | null = null;

  ngOnInit(): void {
    this.queueId = this.route.snapshot.paramMap.get('id') || '';
    this.isCreate = !this.queueId;
    if (this.isCreate) {
      this.queue = {};
      this.applyConfig(null);
      this.loading = false;
      return;
    }
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.api.getQueue(this.queueId).subscribe({
      next: (queue) => {
        this.queue = queue;
        this.applyQueue(queue);
        this.applyConfig(queue?.display);
        this.loading = false;
        if (this.route.snapshot.queryParamMap.get('created') === '1') {
          this.success = 'File créée. Vous pouvez compléter sa configuration.';
        }
      },
      error: (error) => {
        this.loading = false;
        if (error?.status === 401) {
          this.router.navigateByUrl('/login');
          return;
        }
        this.error =
          error?.status === 404
            ? 'Cette file est introuvable.'
            : this.extractError(error);
      }
    });
  }

  private applyQueue(queue: any): void {
    const value = queue && typeof queue === 'object' ? queue : {};
    this.name = String(value.name || '');
    this.code = String(value.code || '');
    this.description = String(value.description || '');
    this.prefix = String(value.prefix || '');
    this.zone = String(value.zone || '');
    this.priority = Number.isFinite(Number(value.priority)) ? Number(value.priority) : 0;
    this.active = value.active !== false;
  }

  private applyConfig(config: any): void {
    const cfg = config && typeof config === 'object' ? config : {};
    this.primaryColor = this.isHex(cfg.primaryColor) ? cfg.primaryColor : '#91cc00';
    this.secondaryColor = this.isHex(cfg.secondaryColor) ? cfg.secondaryColor : '#eeeeee';
    this.messageColor = cfg.messageColor === 'white' ? 'white' : 'black';
    this.separator = typeof cfg.separator === 'string' && cfg.separator.length <= 3 ? cfg.separator : '•';
    this.messages = Array.isArray(cfg.messages)
      ? cfg.messages.slice(0, 50).map((message: any) => String(message ?? ''))
      : ['Bienvenue à QueueRite', 'Merci de patienter, vous serez appelé bientôt'];
    this.media = Array.isArray(cfg.media)
      ? cfg.media
          .filter((item: any) => item && item.assetId)
          .slice(0, this.maxMedia)
          .map((item: any) => ({
            assetId: String(item.assetId),
            name: String(item.name || 'Média'),
            mimeType: String(item.mimeType || ''),
            type: item.type === 'video' ? 'video' : 'image'
          }))
      : [];
    const logoItem = cfg.logo && cfg.logo.assetId ? cfg.logo : null;
    this.logo = logoItem
      ? {
          assetId: String(logoItem.assetId),
          name: String(logoItem.name || 'Logo'),
          mimeType: String(logoItem.mimeType || ''),
          type: logoItem.type === 'video' ? 'video' : 'image'
        }
      : null;
  }

  get previewMessages(): string[] {
    return this.messages.map((message) => message.trim()).filter(Boolean);
  }

  get canAddMedia(): boolean {
    return this.media.length < this.maxMedia && !this.uploading;
  }

  isHex(value: string): boolean {
    return /^#[0-9a-fA-F]{6}$/.test(String(value || ''));
  }

  isPriorityValid(): boolean {
    const priority = Number(this.priority);
    return Number.isInteger(priority) && priority >= 0 && priority <= 9999;
  }

  isValid(): boolean {
    const name = this.name.trim();
    const code = this.code.trim();
    const priority = Number(this.priority);
    return (
      name.length > 0 &&
      name.length <= 120 &&
      code.length > 0 &&
      code.length <= 32 &&
      this.description.length <= 500 &&
      this.prefix.length <= 8 &&
      this.zone.length <= 80 &&
      Number.isInteger(priority) &&
      priority >= 0 &&
      priority <= 9999 &&
      this.isHex(this.primaryColor) &&
      this.isHex(this.secondaryColor) &&
      (this.messageColor === 'black' || this.messageColor === 'white') &&
      !!this.separator &&
      this.separator.length <= 3 &&
      this.media.length <= this.maxMedia &&
      this.messages.length <= 50 &&
      this.messages.every((message) => message.length <= 200)
    );
  }

  addMessage(): void {
    if (this.messages.length >= 50) return;
    this.messages.push('');
  }

  removeMessage(index: number): void {
    this.messages.splice(index, 1);
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackMedia(_index: number, item: DisplayMediaItem): string {
    return item.assetId;
  }

  mediaUrl(item: DisplayMediaItem): string {
    return this.api.mediaUrl(item.assetId);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (this.media.length >= this.maxMedia) {
      this.setNotice(`Maximum ${this.maxMedia} médias par file.`, true);
      return;
    }
    if (file.size > this.maxFileSize) {
      this.setNotice('Fichier trop volumineux (100 Mo maximum).', true);
      return;
    }
    if (file.type && !file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      this.setNotice('Seules les images et les vidéos sont acceptées.', true);
      return;
    }

    this.uploading = true;
    this.api.uploadMedia(file).subscribe({
      next: (uploaded) => {
        this.uploading = false;
        this.media.push({
          assetId: uploaded.id,
          name: uploaded.name || file.name,
          mimeType: uploaded.mimeType || file.type,
          type: uploaded.type === 'video' ? 'video' : 'image'
        });
        this.setNotice('Média importé. Enregistrez pour l’appliquer à l’écran.');
      },
      error: (error) => {
        this.uploading = false;
        if (error?.status === 401) {
          this.router.navigateByUrl('/login');
          return;
        }
        this.setNotice(this.extractError(error), true);
      }
    });
  }

  onLogoFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > this.maxFileSize) {
      this.setNotice('Fichier logo trop volumineux (100 Mo max).', true);
      return;
    }
    if (file.type && !file.type.startsWith('image/')) {
      this.setNotice('Le logo doit être une image.', true);
      return;
    }
    this.uploading = true;
    this.api.uploadMedia(file).subscribe({
      next: (uploaded: any) => {
        this.uploading = false;
        this.logo = {
          assetId: uploaded.id,
          name: uploaded.name || file.name,
          mimeType: uploaded.mimeType || file.type,
          type: 'image'
        };
        this.setNotice('Logo importé. Enregistrez pour l’appliquer.');
      },
      error: (error: any) => {
        this.uploading = false;
        this.setNotice(this.extractError(error), true);
      }
    });
  }


  removeMedia(index: number): void {
    const item = this.media[index];
    if (item?.assetId && item.assetId !== '') {
      this.api.removeMedia(item.assetId).subscribe({
        next: () => {},
        error: () => {}
      });
    }
    this.media.splice(index, 1);
  }

  removeLogo(): void {
    if (this.logo?.assetId) {
      this.api.removeMedia(this.logo.assetId).subscribe({
        next: () => {},
        error: () => {}
      });
    }
    this.logo = null;
  }

  save(): void {
    if (!this.isValid() || this.saving) return;

    this.saving = true;
    this.error = '';
    this.success = '';

    const payload = {
      name: this.name.trim(),
      code: this.code.trim(),
      description: this.description.trim(),
      prefix: this.prefix.trim(),
      zone: this.zone.trim(),
      priority: Number(this.priority),
      active: this.active,
      display: {
        primaryColor: this.primaryColor.toLowerCase(),
        secondaryColor: this.secondaryColor.toLowerCase(),
        messageColor: this.messageColor,
        separator: this.separator,
        messages: this.messages.map((message) => message.trim()).filter(Boolean),
        media: this.media.map((item) => ({
          assetId: item.assetId,
          name: item.name,
          mimeType: item.mimeType,
          type: item.type
        })),
        logo: this.logo ? {
          assetId: this.logo.assetId,
          name: this.logo.name,
          mimeType: this.logo.mimeType,
          type: this.logo.type
        } : undefined
      }
    };

    const request = this.isCreate
      ? this.api.createQueue(payload)
      : this.api.updateQueue(this.queueId, payload);

    request.subscribe({
      next: (queue) => {
        this.saving = false;
        this.queue = queue;
        this.applyQueue(queue);
        this.applyConfig(queue?.display);

        if (this.isCreate && queue?._id) {
          this.isCreate = false;
          this.queueId = String(queue._id);
          this.router.navigate(['/queues', this.queueId, 'edit'], {
            queryParams: { created: '1' }
          });
          return;
        }

        this.success = 'File enregistrée. L’écran se met à jour automatiquement.';
      },
      error: (error) => {
        this.saving = false;
        if (error?.status === 401) {
          this.router.navigateByUrl('/login');
          return;
        }
        this.error = this.extractError(error);
      }
    });
  }

  cancel(): void {
    this.router.navigateByUrl('/queues');
  }

  private setNotice(message: string, isError = false): void {
    this.error = isError ? message : '';
    this.success = isError ? '' : message;
  }

  private extractError(error: any): string {
    const message = error?.error?.message;
    if (Array.isArray(message)) return message.join(' ');
    if (typeof message === 'string' && message) return message;
    return 'Une erreur est survenue. Veuillez réessayer.';
  }
}
