import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  /**
   * URL de base de l'API, relue a CHAQUE acces : ainsi une sauvegarde du
   * modal de config (localStorage 'queue_api') est prise en compte
   * immediatement, sans rechargement de la page.
   */
  get base(): string {
    return ApiService.resolveBase();
  }

  /**
   * URL de base de l'API.
   * - Priorité à la valeur stockée (localStorage) ;
   * - Sinon derivee de l'hote qui sert la page, pour que l'app marche
   *   aussi bien en local (localhost) que depuis un autre PC du reseau
   *   (http://IP:3000/api) sans configuration manuelle.
   */
  private static resolveBase(): string {
    const stored = localStorage.getItem('queue_api');
    if (stored) return stored;
    const host = window.location.hostname || 'localhost';
    return `http://${host}:3000/api`;
  }

  
  login(username: string, password: string) {
    return this.http.post<any>(`${this.base}/auth/login`, { username, password });
  }

  me() {
    return this.http.get<any>(`${this.base}/auth/me`);
  }

  list(entity: string) {
    return this.http.get<any[]>(`${this.base}/resources/${entity}`);
  }

  create(entity: string, data: any) {
    return this.http.post<any>(`${this.base}/resources/${entity}`, data);
  }

  update(entity: string, id: string, data: any) {
    return this.http.patch<any>(`${this.base}/resources/${entity}/${id}`, data);
  }

  remove(entity: string, id: string) {
    return this.http.delete<any>(`${this.base}/resources/${entity}/${id}`);
  }

  getQueue(id: string) {
    return this.http.get<any>(`${this.base}/file/${id}`);
  }

  createQueue(data: any) {
    return this.http.post<any>(`${this.base}/file/queues`, data);
  }

  updateQueue(id: string, data: any) {
    return this.http.patch<any>(`${this.base}/file/${id}`, data);
  }

  updateQueueDisplay(id: string, data: any) {
    return this.http.patch<any>(`${this.base}/file/${id}/display`, data);
  }

  listCounters(query?: { queueId?: string }) {
    const qs = query?.queueId ? `?queueId=${query.queueId}` : '';
    return this.http.get<any[]>(`${this.base}/counters${qs}`);
  }

  getCounter(id: string) {
    return this.http.get<any>(`${this.base}/counters/${id}`);
  }

  createCounter(data: any) {
    return this.http.post<any>(`${this.base}/counters`, data);
  }

  updateCounter(id: string, data: any) {
    return this.http.patch<any>(`${this.base}/counters/${id}`, data);
  }

  removeCounter(id: string) {
    return this.http.delete<any>(`${this.base}/counters/${id}`);
  }

  caisseOnline() {
    return this.http.post<any>(`${this.base}/counters/me/online`, {});
  }

  caisseOffline() {
    return this.http.post<any>(`${this.base}/counters/me/offline`, {});
  }

  caissePause(paused: boolean) {
    return this.http.post<any>(`${this.base}/counters/me/pause`, { paused });
  }

  myCurrentTicket() {
    return this.http.get<any>(`${this.base}/counters/me/current-ticket`);
  }

  removeMedia(id: string) {
    return this.http.delete<any>(`${this.base}/media/${id}`);
  }

  uploadMedia(file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<any>(`${this.base}/media/upload`, form);
  }

  mediaUrl(assetId: string) {
    return `${this.base}/public/media/${assetId}`;
  }

  tickets() {
    return this.http.get<any[]>(`${this.base}/tickets`);
  }

  waiting(queueId: string) {
    return this.http.get<any[]>(`${this.base}/tickets/waiting/${queueId}`);
  }

  callNext(queueId: string, counterId: string) {
    return this.http.post<any>(`${this.base}/tickets/call-next`, { queueId, counterId });
  }

  recallTicket(id: string) {
    return this.http.post<any>(`${this.base}/tickets/${id}/recall`, {});
  }

  transition(id: string, action: string) {
    return this.http.post<any>(`${this.base}/tickets/${id}/${action}`, {});
  }

  createTicket(queueId: string) {
    return this.http.post<any>(
      `${this.base}/tickets`,
      { queueId, source: 'admin' },
      { headers: { 'Idempotency-Key': crypto.randomUUID() } }
    );
  }

  dashboardStats() {
    return this.http.get<any>(`${this.base}/dashboard/stats`);
  }
}
