import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../api.service';

@Component({
  selector: 'queue-admin-config',
  standalone: true,
  imports: [FormsModule],
  templateUrl: 'admin-config.component.html', styleUrls: ['admin-config.component.scss'],
  styles: `.config-page{padding:1rem;}`
})
export class AdminConfigComponent {
  primaryColor = '#0055a5';
  secondaryColor = '#f4b400';
  logoUrl = '';
  guardImageUrl = '';
  messageSpeed = 5;
  separator = '*';
  messages = 'Bienvenue\nTickets en cours';
  constructor(private api: ApiService) {}
  save() {
    const data = { primaryColor: this.primaryColor, secondaryColor: this.secondaryColor, logoUrl: this.logoUrl, guardImageUrl: this.guardImageUrl, messageSpeed: this.messageSpeed, separator: this.separator, messages: this.messages };
    this.api.create('appSettings', { ...data, scope: 'file', key: 'display_config' }).subscribe(r => console.log('Config saved', r));
  }
}
