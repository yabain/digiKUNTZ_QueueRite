# Plan — Status cancelled + cron hourly + daily reset verification

CONTEXT BRIEF
Area: backend tickets bulk-cancel + cron + frontend badge
Ground truth: /Users/flambel/Documents/GitHub/Queue_Rite/Queue_App_Backend_v1.0/src/modules/tickets/tickets.module.ts (TicketSchema line 4, list line 15, no cron), /Users/flambel/Documents/GitHub/Queue_Rite/Queue_App_Frontend_Angular17_v1.0/src/app/tickets/
Backend: NestJS + Mongoose, @nestjs/schedule installed but unused, DB queue_app rs0, index {establishmentId,operationalDate,status} exists
Frontend: tickets.component standalone, statusClass/label need cancelled
Constraints: no audit event batch required; bulk update must be limited; cron every hour (0 * * * *)
Reuse: existing TicketSchema, existing @nestjs/schedule dep, existing index
Deviations: no TicketEvent written for cancelled bulk (accepted by user)
Open questions: none — user confirmed proceed

STEPS
1. Schema/service (backend): add 'cancelled' to allowed status logic; add bulk update method in tickets.module/controller or new job service.
2. Cron job (backend): import ScheduleModule.forRoot() in app.module.ts; create @Cron('0 * * * *') job calling bulk method.
3. Frontend: add 'cancelled' badge and label in tickets.component.
4. Verify build both sides.
