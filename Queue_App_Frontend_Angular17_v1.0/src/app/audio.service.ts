import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AudioService {
  speak(text: string, lang: 'fr' | 'en' = 'fr') {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang === 'fr' ? 'fr-FR' : 'en-US';
    utter.rate = 1;
    window.speechSynthesis.speak(utter);
  }
}
