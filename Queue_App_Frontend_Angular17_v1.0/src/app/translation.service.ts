import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private http = inject(HttpClient);
  private translations: Record<string, string> = {};
  private lang = 'fr';

  load(lang: string) {
    this.lang = lang;
    this.http.get<Record<string, string>>(`assets/i18n/${lang}.json`).subscribe(t => this.translations = t);
  }

  t(key: string): string {
    return this.translations[key] || key;
  }
}
