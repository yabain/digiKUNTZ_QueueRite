import { Routes } from '@angular/router';
import { adminGuard } from './admin.guard';
import { LoginComponent } from './login/login.component';
import { HomePageComponent } from './home-page/home-page.component';
import { WorkspaceComponent } from './workspace/workspace.component';
import { CashierComponent } from './cashier/cashier.component';
import { StatisticsComponent } from './statistics/statistics.component';
import { FileDisplayComponent } from './file-display/file-display.component';
import { TicketPrintComponent } from './ticket-print/ticket-print.component';
import { FileListComponent } from './file-list/file-list.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { FileConfigComponent } from './file-config/file-config.component';
import { CallerPostComponent } from './caller-post/caller-post.component';
import { QueueDetailComponent } from './queue-detail/queue-detail.component';
import { CounterListComponent } from './counter-list/counter-list.component';
import { CounterFormComponent } from './counter-form/counter-form.component';
import { TicketsComponent } from './tickets/tickets.component';
import { FilePOSComponent } from './file-pos.component';
import { UsersComponent } from './users/users.component';

// Important: specific routes must be declared before the generic ':entity'
// route, otherwise '/dashboard', '/queues', '/stats', ... are captured by it.
export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', component: HomePageComponent },
  { path: 'dashboard', canActivate: [adminGuard], component: DashboardComponent },
  { path: 'queues/new', canActivate: [adminGuard], component: FileConfigComponent },
  { path: 'queues/:id/edit', canActivate: [adminGuard], component: FileConfigComponent },
  { path: 'queues', canActivate: [adminGuard], component: FileListComponent },
  // Legacy aliases: keep old bookmarks working without rendering duplicate pages.
  { path: 'files/new', redirectTo: 'queues/new', pathMatch: 'full' },
  { path: 'files/:id/config', redirectTo: 'queues/:id/edit', pathMatch: 'full' },
  { path: 'files/:id/edit', redirectTo: 'queues/:id/edit', pathMatch: 'full' },
  { path: 'files', redirectTo: 'queues', pathMatch: 'full' },
  { path: 'file/:id/pos', component: FilePOSComponent },
  { path: 'queue/:id', component: QueueDetailComponent },
  { path: 'admin/config', redirectTo: 'queues', pathMatch: 'full' },
  { path: 'caller', component: CallerPostComponent },
  { path: 'counters/new', canActivate: [adminGuard], component: CounterFormComponent },
  { path: 'counters/:id/edit', canActivate: [adminGuard], component: CounterFormComponent },
  { path: 'counters', canActivate: [adminGuard], component: CounterListComponent },
  { path: 'caisse', component: CashierComponent },
  { path: 'stats', canActivate: [adminGuard], component: StatisticsComponent },
  { path: 'displays', canActivate: [adminGuard], component: FileDisplayComponent },
  { path: 'displays/:id', component: FileDisplayComponent },
  { path: 'tickets/print', canActivate: [adminGuard], component: TicketPrintComponent },
  { path: 'tickets', canActivate: [adminGuard], component: TicketsComponent },
  { path: 'users', canActivate: [adminGuard], component: UsersComponent },
  { path: ':entity', canActivate: [adminGuard], component: WorkspaceComponent },
  { path: '**', redirectTo: '' }
];

