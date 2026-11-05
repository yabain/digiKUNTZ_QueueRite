import {Component,inject} from '@angular/core';
import {RouterOutlet,RouterLink,Router,NavigationEnd} from '@angular/router';
import {CommonModule} from '@angular/common';
import {filter} from 'rxjs/operators';
@Component({selector:'queue-root',standalone:true,imports:[RouterOutlet,RouterLink,CommonModule],templateUrl: 'app.component.html', styleUrls: ['app.component.scss']})
export class AppComponent{
  router=inject(Router);
  constructor(){
    this.syncBodyClass();
    this.router.events.pipe(filter(e=>e instanceof NavigationEnd)).subscribe(()=>this.syncBodyClass());
  }
  /** Locks html/body scrolling while a full-screen screen is displayed. */
  private syncBodyClass(){
    const url=this.router.url;
    const onCaisse=url.startsWith('/caisse');
    const onPos=this.isPosUrl(url);
    document.documentElement.classList.toggle('caisse-fullscreen',onCaisse);
    document.body.classList.toggle('caisse-fullscreen',onCaisse);
    document.documentElement.classList.toggle('pos-fullscreen',onPos);
    document.body.classList.toggle('pos-fullscreen',onPos);
  }
  isPosUrl(url:string){return /^\/file\/[^/]+\/pos(\/|\?|$)/.test(url);}
  get connected(){return !!localStorage.getItem('queue_token')}
  get showNav(){
    const url=this.router.url;
    if(url==='/') return false;
    if(url.startsWith('/displays')||url.startsWith('/tickets/print')) return false;
    if(url.startsWith('/caisse')||this.isPosUrl(url)||url==='/login') return false;
    return true;
  }
  get fullBleed(){
    const url=this.router.url;
    return url.startsWith('/displays')||url.startsWith('/tickets/print')||this.isPosUrl(url)||(url==='/')||(url==='/login');
  }
  logout(){localStorage.removeItem('queue_token');this.router.navigateByUrl('/');}
}
