# Plan: Queues — dedicated create/edit page (no inline creation)

Repo root: `/Users/flambel/Documents/GitHub/Queue_Rite`
Scope: `Queue_App_Frontend_Angular17_v1.0` + `Queue_App_Backend_v1.0`.

## Context

- Ground truth read:
  - Frontend: `src/app/app.routes.ts`, `src/app/api.service.ts`, `src/app/file-list/file-list.component.{ts,html,scss}`,
    `src/app/file-config/file-config.component.{ts,html,scss}`, `src/app/queue-detail/queue-detail.component.{ts,html}`,
    `src/app/app/app.component.html`, `src/app/dashboard/dashboard.component.html`, `src/app/auth.interceptor.ts`,
    `src/app/login/login.component.ts`, `package.json`, `angular.json`, `tsconfig.json`.
  - Backend: `src/modules/file/file.module.ts`, `src/modules/file/display-config.dto.ts`, `src/modules/file/media.controller.ts`,
    `src/modules/file/public.controller.ts`, `src/modules/domain/domain.module.ts`, `src/modules/domain/schemas.ts`,
    `src/common/security.ts`, `src/main.ts`, `src/app.module.ts`, `package.json`, `scripts/seed-admin.js`.
- Versions: Angular 17.3 (standalone, template-driven `FormsModule` + `ngModel`, strict templates), NestJS 10.4,
  Mongoose 8.9, class-validator 0.14, class-transformer 0.5. Global `ValidationPipe({whitelist:true, transform:true,
  forbidNonWhitelisted:true})` in `src/main.ts`.
- Existing patterns: 3 files per component, component-local SCSS with the palette `#2868dc / #dce2ec / #5b667b`,
  hardcoded French labels (no i18n on these pages), `ApiService` thin wrappers, backend uses one-file-per-module
  controllers and `SessionGuard` + `RolesGuard`/`@Roles`.
- Current state: `/queues` falls through to `WorkspaceComponent` (which also has an inline create form). The real list is
  `/files` (`FileListComponent`) with an inline create form and row actions; `Éditer` opens `/files/:id/config`
  (`FileConfigComponent`) which is display-config only. Backend queue writes only exist as unvalidated generic
  `POST/PATCH /api/resources/queues` (`$set: body`, mass-assignment) plus a validated `PATCH /api/file/:id/display`.
- Live stack verified: backend on `:3000` (health ok), Angular dev server on `:4200`, MongoDB replica set up,
  admin session works. Existing queue data includes one queue **without** `display` (edit must tolerate it).

## Goal

Make `/queues` the canonical queue list. "Nouvelle file" navigates to `/queues/new`, a full-page form containing every
queue metadata field and the existing display configuration (colors, messages, separator, media ≤ 3). Each list row has
an `Éditer` button opening `/queues/:id/edit`, prefilled. Creation and editing go through validated backend endpoints;
the inline create form is removed from the list.

Success criteria:
1. `/queues` renders the list only (no inline form); `/files` still works for compatibility.
2. `POST /api/file/queues` creates a queue with metadata + optional nested `display`, scoped to the session establishment.
3. `PATCH /api/file/:id` updates any subset of metadata and/or the full `display`; rejects unknown/invalid fields.
4. List `Éditer`, list `Activer/Désactiver`, and queue-detail "Configurer l'écran" all land on the edit page.
5. No regression on public display endpoints, ticket issuance (`prefix`), or generic resources for other entities.

## Out of scope

- `displayIds` (screen assignment), playlist/media library management, media deletion/cleanup job.
- Removing or redirecting `/files`; changing `WorkspaceComponent` for other entities.
- DB migration / unique index on `(establishmentId, code)` (recommended follow-up only).
- Deleting queues safely when tickets/counters reference them.
- The Ionic/Electron frontend (`Queue_App_Frontend_Ionic_Electron_Windows_v1.0`).
- New test framework bootstrap (see Validation caveat).

## API contracts

All routes under global prefix `/api`, `Authorization: Bearer <token>` required. Roles: `super_admin`, `admin`,
`supervisor`, `technician`.

### `POST /api/file/queues` → 201

```json
{
  "name": "Accueil",                    // required, trimmed, 1..120
  "code": "ACC",                        // required, trimmed, 1..32
  "description": "File d'accueil",      // optional, <= 500
  "active": true,                       // optional boolean, default true
  "priority": 0,                        // optional int 0..9999, default 0
  "prefix": "A",                        // optional, trimmed, <= 8
  "zone": "Rez-de-chaussée",            // optional, trimmed, <= 80
  "display": { /* DisplayConfigDto, optional */ }
}
```

`display` when present is the **full** `DisplayConfigDto` (reuse existing class): `primaryColor`/`secondaryColor`
`#RRGGBB`, `messageColor` `black|white`, `separator` 1..3 chars, `messages` string[] ≤ 50 (each ≤ 200),
`media` ≤ 3 of `{assetId: MongoId, name ≤200, mimeType ≤100, type: image|video}`.

- `establishmentId` is taken from the session and injected server-side; never from the body.
- Duplicate `code` in the establishment → `409 Conflict`.
- Any `display.media[].assetId` not owned by the session establishment → `400`.
- Response: the created queue document (`_id`, `establishmentId`, metadata, `display`, timestamps).

### `PATCH /api/file/:id` → 200

Same fields, all optional; `display` when present is still the full object (no partial display). Empty body → `400`.
Unknown field → `400` (`forbidNonWhitelisted`). Not found / other establishment / invalid ObjectId → `404`.
Duplicate `code` (excluding self) → `409`. Response: updated queue document.

### Preserved

- `GET /api/file/:id` (edit page load), `PATCH /api/file/:id/display` (kept for compatibility; frontend stops using it),
  `GET /api/file/queues` (active-only, used by kiosk/cashier — do **not** use for the admin list).
- `GET /api/resources/queues` remains the list source (includes inactive).
- Error body follows Nest defaults: `{ statusCode, message: string | string[], error }`; `FileConfigComponent.extractError`
  already joins arrays.

## Tasks

1. **Backend: queue DTOs.** New file `Queue_App_Backend_v1.0/src/modules/file/queue.dto.ts`.
   - `CreateQueueDto`: `@Transform(trim)` + `@IsString @MinLength(1) @MaxLength(120)` name;
     `@Transform(trim)` + `@IsString @MinLength(1) @MaxLength(32)` code;
     optional `description` (≤500), `prefix` (≤8), `zone` (≤80); optional `@IsBoolean active`;
     optional `@Type(() => Number) @IsInt @Min(0) @Max(9999) priority`;
     optional `@IsOptional @ValidateNested @Type(() => DisplayConfigDto) display`.
   - `UpdateQueueDto`: same but every field `@IsOptional` (define explicitly; do **not** use `PartialType` —
     `@nestjs/mapped-types` is not installed and decorator inheritance with `IsOptional` is error-prone).
   - Files: `src/modules/file/queue.dto.ts`. Proof: `npx tsc --noEmit -p tsconfig.json`; later curl negative tests.
     Depends on: none.

2. **Backend: dedicated create/update endpoints.** `Queue_App_Backend_v1.0/src/modules/file/file.module.ts`.
   - Change controller decorator to `@UseGuards(SessionGuard, RolesGuard)`; add `RolesGuard` to `FileModule.providers`.
   - Inject `@InjectModel('MediaAsset')` and `@InjectModel('AuditLog')`.
   - `@Post('queues') @Roles(...) createQueue(@Req req, @Body() dto: CreateQueueDto)`:
     build `patch` from defined keys only (drop `undefined`/`null`), duplicate-code check
     (`this.queues.exists({establishmentId, code})`), media ownership check (`countDocuments({_id:{$in:uniqueIds},
     establishmentId})` vs unique id count), `this.queues.create({...patch, establishmentId})`, audit log
     `{action:'create', entity:'queues', entityId}`, return `doc.toObject()`.
   - `@Patch(':id') @Roles(...) updateQueue(@Req req, @Param('id') id, @Body() dto: UpdateQueueDto)`:
     validate ObjectId → 404; empty patch → 400; duplicate-code check when `code` present
     (`_id: {$ne: id}`); media ownership check when `display` present; `findOneAndUpdate({_id, establishmentId},
     {$set: patch}, {new:true, runValidators:true})`; 404 if null; audit log `action:'update'`; return the doc.
   - Leave `GET`, `:id/display`, `:id/counters`, `:id/pos`, `:id/number`, `:id/next` unchanged. Optionally add
     `@Roles(...)` to `:id/display` (tightening — see Risks).
   - Files: `src/modules/file/file.module.ts`. Proof: curl matrix below. Depends on: 1.

3. **Backend: harden generic queue writes.** `Queue_App_Backend_v1.0/src/modules/domain/domain.module.ts`.
   - Add `QUEUE_WRITABLE = ['name','code','description','active','priority','prefix','zone']` and
     `QUEUE_FORBIDDEN = ['display','displayIds','establishmentId','_id','createdAt','updatedAt','version']`.
   - In `ResourcesController.create` and `.update`, when `entity === 'queues'`: throw `BadRequestException` if a forbidden
     key is present (message points to `/api/file/...`), otherwise keep only writable keys before `create`/`$set`.
     Other entities keep current behavior (`entity !== 'queues'` short-circuit).
   - Files: `src/modules/domain/domain.module.ts`. Proof: curl negative tests; regression: create/update a `counter`
     through `/api/resources/counters` still works. Depends on: none (independent of 2).

4. **Frontend: API client.** `Queue_App_Frontend_Angular17_v1.0/src/app/api.service.ts`.
   - `createQueue(payload: any) { return this.http.post<any>(`${this.base}/file/queues`, payload); }`
   - `updateQueue(id: string, payload: any) { return this.http.patch<any>(`${this.base}/file/${id}`, payload); }`
   - Keep `getQueue`, `updateQueueDisplay`, `uploadMedia`, `list/create/update/remove` untouched.
   - Proof: `npm run build`. Depends on: 2 (contract).

5. **Frontend: routes.** `Queue_App_Frontend_Angular17_v1.0/src/app/app.routes.ts`.
   - Insert before the generic `:entity` route (and before `files` is fine):
     `{ path: 'queues', component: FileListComponent }`,
     `{ path: 'queues/new', component: FileConfigComponent }`,
     `{ path: 'queues/:id/edit', component: FileConfigComponent }`.
   - Keep `files` and `files/:id/config` unchanged. Comment already warns about `:entity` ordering.
   - Proof: `npm run build`; manual URL checks `/queues`, `/queues/new`, `/queues/<id>/edit`. Depends on: none.

6. **Frontend: list page (remove inline create, repoint actions).**
   `file-list.component.ts`, `.html`, `.scss`.
   - TS: delete `showCreate`, `newName`, `newCode`, `saving`, `create()`; `edit(f)` →
     `this.router.navigate(['/queues', f._id, 'edit'])`; `toggle(f)` → `this.api.updateQueue(f._id, { active: !f.active })`
     (dedicated endpoint, no generic PATCH); keep `open`, `remove`, `trackById`, `flash`.
   - HTML: replace the `Nouvelle file` button with `<a routerLink="/queues/new" class="btn primary">Nouvelle file</a>`;
     delete the `<form class="panel create-panel">` block; update subtitle to "Sélectionnez une file pour l'éditer."
   - SCSS: remove `.create-panel` and `.create-grid` (and the mobile `.create-grid` rule).
   - Proof: `npm run build`; DOM check that `form.create-panel` is absent and the `a[href="/queues/new"]` exists.
     Depends on: 4, 5.

7. **Frontend: edit page — metadata fields + save through `updateQueue`.**
   `file-config.component.ts`, `.html`, `.scss`.
   - TS: add `name=''`, `code=''`, `description=''`, `prefix=''`, `zone=''`, `priority=0`, `active=true`.
     In `load()`, map from the queue with safe defaults (`String(...)`, `Number(...) || 0`, `active !== false`).
     Extend `isValid()` with: `name.trim()` 1..120, `code.trim()` 1..32, `description.length <= 500`,
     `prefix.length <= 8`, `zone.length <= 80`, integer `priority` 0..9999. Replace the
     `updateQueueDisplay` call with `api.updateQueue(queueId, payload)` where `payload` is built explicitly:
     metadata + `display` (existing `display` payload block). Update `queue` from the response.
   - HTML: new first panel "Informations de la file" with Nom*, Code*, Description (textarea), Préfixe, Zone,
     Priorité (`type="number"`), Actif (checkbox); inline field errors for name/code. Keep the colors/messages/media
     panels and preview untouched. Header title uses `name || 'Nouvelle file'`, code badge uses `code`.
   - SCSS: add `.form-grid` (2 columns, 1 on ≤760px), `.field` label/input styles, `.checkbox` row, reusing existing
     colors/radii.
   - Proof: `npm run build`; edit an existing queue (including the one with no `display`) and confirm 200 + persisted
     fields. Depends on: 4.

8. **Frontend: create mode on the same page.**
   `file-config.component.ts`, `.html`.
   - `get isCreate() { return !this.queueId; }`.
   - `ngOnInit`: remove the redirect to `/files` when no id; if `isCreate` set `this.queue = {}` and
     `this.loading = false`, else `load()`. Read `created=1` query param to show
     `success = 'File créée. Vous pouvez compléter sa configuration.'`.
   - `save()`: if `isCreate` → `api.createQueue(payload)`, then
     `router.navigate(['/queues', id, 'edit'], { queryParams: { created: '1' }, replaceUrl: true })`;
     else `api.updateQueue`. Save button label `Créer la file` / `Enregistrement…` when creating.
   - `cancel()` and the two back links → `/queues`. Error state block must not show "introuvable" in create mode
     (`queue = {}` keeps `*ngIf="!loading && queue"` true).
   - HTML: eyebrow "Création d'une file" vs "Édition de la file"; subtitle explains metadata + screen config.
   - Proof: full browser flow create → edit → list (checklist below). Depends on: 7.

9. **Frontend: repoint secondary entry points.**
   - `src/app/app/app.component.html`: nav `Files` → `routerLink="/queues"`.
   - `src/app/dashboard/dashboard.component.html`: "Voir les files" → `/queues`.
   - `src/app/queue-detail/queue-detail.component.ts`: `editDisplay()` → `/queues/:id/edit`;
     `.html` back link → `/queues`.
   - Proof: `npm run build`; click-through from nav, dashboard, queue detail. Depends on: 5, 8.

10. **Verification + cleanup.** Run the checklist; delete created queues, media asset + disk file, and test sessions.
    Depends on: all.

Parallelizable: 1→2 and 3 are backend-only; 4 and 5 are independent frontend groundwork; 6 and 7 can run in parallel
after 4+5; 8 depends on 7; 9 depends on 8.

## Security

- New endpoints derive `establishmentId` and `actorId` from `req.user` only; never trust body scoping.
- `RolesGuard` must be listed **after** `SessionGuard` so `req.user` exists; `@Roles` on each mutating handler.
  Class-level `RolesGuard` is a no-op when no metadata is present, so existing `GET`s keep working for `agent`/`kiosk`.
- Explicit allowlists prevent mass assignment. The generic `/api/resources/queues` path currently allows
  `establishmentId`/`display` overwrite; task 3 closes it. Dedicated DTOs + global `forbidNonWhitelisted` reject extras.
- Media ownership check prevents referencing another establishment's `MediaAsset`; `public/media/:id` remains
  unauthenticated by design (display screens) — do not change it.
- `display.messages` are rendered with Angular text interpolation (no `innerHTML`); no XSS vector introduced.
- Audit log entries are written for create/update, matching the generic controller behavior.
- 401 → redirect to `/login`; 403 → explicit "droits insuffisants" message (do not silently swallow).

## Risks

- **Partial `display` update rejected** — `PATCH /api/file/:id` accepts the full `DisplayConfigDto` only. The toggle sends
  `{active}` (fine); any caller sending a partial display gets 400. Mitigation: frontend always sends the full display.
- **Edit overwrites legacy display** — `applyConfig` sanitizes invalid/absent display to defaults; saving metadata then
  writes those defaults. Acceptable (the one queue without `display` gets a valid default), but document it.
- **Duplicate code race** — no unique index on `(establishmentId, code)`; the pre-check is not atomic. Follow-up: dedupe
  then add a compound unique index. Do not add the index in this change (may fail on existing data).
- **Code case sensitivity** — comparison is exact after trim. Existing codes are lowercase (`jshdkjfs`); do not
  uppercase/normalize or add a charset pattern in v1, it would break editing legacy data.
- **Route ordering** — `/queues` must be declared before `:entity`, otherwise the generic workspace captures it.
  `/queues/new` and `/queues/:id/edit` are two-segment and cannot collide with `:entity`.
- **Roles tightening** — adding `@Roles` to the existing `PATCH /:id/display` may break `agent` clients. Default plan:
  restrict only the new endpoints; add roles to `:id/display` only after confirming no agent workflow depends on it.
- **Generic queue write hardening** — external clients using `/api/resources/queues` with `display` will now get 400.
  Intentional; message points to the dedicated route.
- **Media orphans** — uploading media before saving creates an unreferenced `MediaAsset` + file if the user abandons the
  form. Pre-existing behavior; cheap mitigation: disable the media input until `name`/`code` are valid. Cleanup job is
  out of scope.
- **`active` semantics** — public/kiosk endpoints only see active queues; deactivating mid-day stops new tickets for that
  queue (`POST /:id/next` requires `active:true`) but does not affect issued tickets. Confirm this is expected.
- **`prefix` edits** — only affects display numbers of tickets issued after the change; existing tickets keep theirs.
- **Deleting a queue** still uses generic `DELETE` and can orphan tickets/counters/queueCounters. Out of scope; keep the
  confirm dialog.
- **No automated tests** — `npm test` exits 1 ("No tests found"), `npm run lint` fails (`eslint` not installed).
  Verification is build + live API + browser smoke unless test infra is added (see Validation).

## Validation

Real commands available in this repo (run from the repo root):

```bash
cd Queue_App_Backend_v1.0 && npm run build
cd Queue_App_Backend_v1.0 && npx tsc --noEmit -p tsconfig.json
cd Queue_App_Frontend_Angular17_v1.0 && npm run build
curl -s http://localhost:3000/api/health
```

Caveats (verified, do not guess around them):
- `cd Queue_App_Backend_v1.0 && npm test` → exits 1: **no tests exist** and there is no jest config.
- `cd Queue_App_Backend_v1.0 && npm run lint` → fails: `eslint: command not found` (no ESLint dependency/config).
- The frontend has no `test` or `lint` scripts; `ng build` (strict templates) is the only static gate.
- After `npm run build`, the backend running on `:3000` is the old `dist`; restart it (`npm run start:dev`, or
  `node dist/main.js`) before API checks.

## Verification checklist

Setup (do not print secrets):

```bash
cd Queue_App_Backend_v1.0
U=$(grep -m1 '^ADMIN_USERNAME=' .env | cut -d= -f2-); P=$(grep -m1 '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d "{\"username\":\"$U\",\"password\":\"$P\"}" | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')
API=http://localhost:3000/api; AUTH="Authorization: Bearer $TOKEN"
```

1. **Builds**: backend `npm run build` + `npx tsc --noEmit`, frontend `npm run build` — all clean.
2. **Create (happy path)**: `POST $API/file/queues` with all metadata + full `display` (no media) → `201`; response has
   `_id`, `establishmentId` equal to `/auth/me`, `active:true`, `priority` as number.
3. **Create validation**: missing `name` → `400`; `name:"   "` → `400`; `priority:"abc"` → `400`;
   unknown field `establishmentId` → `400`; `display.media` with 4 items → `400`.
4. **Duplicate code**: same `code` again → `409`; same code with different case → currently allowed (documented).
5. **Media ownership**: `display.media[0].assetId` = random valid ObjectId → `400`.
6. **Update**: `PATCH $API/file/$QID` with `{name, code, description, prefix, zone, priority, active}` → `200`, persisted;
   `{}` → `400`; invalid id `abc` → `404`; unknown id → `404`; partial `{display:{primaryColor:"#91cc00"}}` → `400`;
   `display` full object → `200`; duplicate code of another queue → `409`.
7. **Roles**: create a temporary `agent` session by inserting a `sessions` doc with `role:'agent'`, a known token's
   sha256 hash, and a future `expiresAt` (mongosh on the `.env` URI), then `POST /api/file/queues` with it → `403`;
   delete the session afterwards.
8. **Generic hardening**: `PATCH $API/resources/queues/$QID` with `{display:{...}}` → `400`;
   with `{establishmentId:"<other>"}` → `400`; `POST /api/resources/counters` still `201` (regression check).
9. **Browser** (`http://localhost:4200`, logged in as admin):
   - `/queues` → list renders, **no** inline form, `Nouvelle file` is a link to `/queues/new`.
   - `/queues/new` → all metadata fields + colors/messages/media visible; save disabled until name+code valid.
   - Fill everything, upload 1 image, create → URL becomes `/queues/<id>/edit?created=1`, success banner, values persist.
   - Back to `/queues` → new row; `Éditer` → `/queues/<id>/edit` prefilled (including the image).
   - Toggle `Désactiver` → row shows Désactivé; `GET /api/queues` (public) no longer lists it; re-activate.
   - `/files` still lists and `Éditer` opens `/queues/<id>/edit`.
   - Queue detail "Configurer l'écran" → `/queues/<id>/edit`.
   - Refresh `/queues/new` → form still renders (no redirect to `/files`).
10. **Cleanup**: `DELETE /api/resources/queues/<created ids>`; delete the test `MediaAsset` doc and its file in
    `Queue_App_Backend_v1.0/media/`; delete the temporary `agent` session; confirm `/api/resources/queues` is back to the
    original 2 queues. No test artifacts left.

Optional headless E2E (not a project dependency; system Chrome 156 is installed): use a throwaway Playwright install
(`npm i playwright@1.64.1 --no-save` in a temp dir, `chromium.launch({ channel: 'chrome', headless: true })`) to run
steps 9 with `localStorage.setItem('queue_token', <token>)` before `goto('/queues')`. If the install is not acceptable,
run step 9 manually and rely on the API matrix for automation.
