import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
@Component({ selector:'queue-statistics', standalone:true, imports:[CommonModule], templateUrl: 'statistics.component.html', styleUrls: ['statistics.component.scss'] }) export class StatisticsComponent { stats:any[]=[]; constructor(){ this.stats=[{queueName:'File P1',ticketsCreated:42,ticketsCalled:30,ticketsCompleted:25}]; } }
