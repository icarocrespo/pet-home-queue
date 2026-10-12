# 🐾 Pet Home — Veterinary Priority Queue

A lightweight, **full-TypeScript** veterinary waiting-room application. Staff manage patient visits in a private dashboard, while a TV shows a continuously refreshed, privacy-limited queue inspired by the supplied Pet Home mockup.

## Architecture

```text
Reception / veterinarian (browser)           TV kiosk (browser)
        /admin                                    /display
          |                                         |
Supabase Auth + RLS-protected CRUD           GET /api/queue every 5s
          |                                         |
          +----------- Supabase PostgreSQL ---------+
                        (cloud-hosted)
                         ^          |
            Next.js server-only service role key for
            projection of safe TV fields only
```

**No Java, Spring Boot, microservices or local server are required.** The database and Next.js deployment remain online if clinic computers are shut down. The TV still requires power and internet connectivity. An internet outage prevents new cloud writes; use a documented paper workflow during outages.

## Technology

- Next.js App Router + React + **TypeScript** (one repository/deployment)
- Supabase: managed PostgreSQL, email/password authentication and RLS
- Vanilla CSS (no component library, ORM, Redis or state library)
- Periodic 5-second polling for TV and staff queue; automatic refresh on reconnection
- Vercel or another host that supports Next.js Route Handlers

**Why polling?** For one clinic and a small queue, 5-second refresh is easier to operate than WebSockets and survives missed events. This is **near-real-time**, not push-driven realtime. Revisit Supabase Realtime when measured load requires it.

## Functional MVP

| URL | Access | Features |
| --- | --- | --- |
| `/login` | Public | Staff email/password login |
| `/admin` | Authenticated staff in `staff_members` | Register animal, optional tutor, re-use existing animal, open visit, view waiting/called/in-service queue, change priority with reason (vets/admins), call/start/complete/cancel |
| `/display` | Public read-only | Color-coded priority cards, total by category, arrival times, sorted queue, connectivity warning |
| `/api/queue` | Public read-only | Only visit ID, public label, priority, status and arrival time; no tutor data |

Priority: **URGENT → HIGH → MEDIUM → LOW**; FIFO by server arrival time and deterministic ID tie-break. Staff cancellation preserves visit history; there is intentionally **no destructive delete** in the MVP. Priority is an operational triage decision made by authorized veterinary staff.

### Permissions

- `RECEPTION`: can create animals and visits (new visit priority defaults to LOW), and call/start/cancel/complete visits.
- `VET`: reception permissions plus priority changes and triage reasons.
- `ADMIN`: same permissions as vet; provisioning staff is currently handled through the Supabase dashboard / SQL.
- The public display cannot execute write operations and does not receive tutor details.

## Setup (Supabase)

1. Create a Supabase project and **keep the project and backups enabled** under a plan suited to clinic availability requirements.
2. In **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql) **once on a clean project**. The SQL creates enum types, tables, RLS, staff checks and guarded status/priority RPCs.
3. In **Authentication → Users**, create a staff user (email/password). Find that user's UUID.
4. In SQL Editor, give the first user an authorized role:

   ```sql
   insert into public.staff_members (user_id, role)
   values ('PASTE_AUTH_USER_UUID_HERE', 'ADMIN');
   ```

5. Repeat for additional staff using `RECEPTION`, `VET` or `ADMIN`. Configure email confirmation and auth restrictions appropriate to your operation. **Disable open public sign-ups** when staff accounts are created administratively.
6. Copy `.env.example` to `.env.local` and configure:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-PUBLISHABLE-OR-ANON-KEY
   SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVER-ONLY-SERVICE-ROLE-KEY
   ```

   **Critical:** The service-role key bypasses RLS, so it must exist only in the server environment. Never prefix it with `NEXT_PUBLIC_`, check it into git or pass it to a browser client. Rotate it if leaked. In production set these under your hosting provider's secret environment settings.

## Local development

Requirements: Node.js 20.9+ and npm, Supabase project with schema installed.

```bash
npm install
npm run dev
```

Open `http://localhost:3000/login` for staff, or `http://localhost:3000/display` for TV. `npm run lint` runs the TypeScript type check; `npm run build` creates the production build.

## Production deployment

1. Push the folder to a **private** Git repository (without `.env.local`).
2. Import into Vercel as a Next.js project (or another compatible server host).
3. Add all three variables from `.env.example` as deployment secrets, with service-role key only as a server variable.
4. Deploy; verify `/api/queue` and `/display` on the public HTTPS domain, and `/login` plus `/admin` with a provisioned staff user.
5. Set up managed database backups and periodically test restoration, monitor uptime and errors, and configure a custom clinic domain.
6. On a Smart TV browser, kiosk box or mini-PC open `https://YOUR-DOMAIN/display` in full-screen/kiosk mode. Disable display sleep as appropriate and test reboot/reconnection. A clinic PC need not be left running.

**Privacy:** The TV is public and may be seen by visitors. By default it displays animal names, not owners' names; for stricter privacy, modify check-in to create random queue ticket labels instead of pet names. Clinical notes and contact data should never appear on TV. Determine lawful basis, notices and retention under Brazil's LGPD before collecting owner details.

## Operating guide

1. Staff member signs into `/login` and opens `/admin`.
2. Search for an existing animal and select it, **or** enter a new name, species and optional tutor.
3. A veterinarian can assign priority on check-in; reception creates LOW-priority entries until triage.
4. Click **Adicionar à fila**. It appears on TV within roughly five seconds.
5. Vet/admin can select a different priority and enter a required reason.
6. Click **Chamar → Iniciar → Concluir** to progress through treatment; **Cancelar** is available before treatment starts.
7. If offline, the TV shows a warning and keeps its last loaded view. No offline editing or sync is included.

## Data model

- `patients`: persistent animal record with optional tutor name; never directly queried by public queue route.
- `visits`: individual clinic arrivals, statuses, urgency and public label.
- `staff_members`: maps Supabase Auth identity to clinic role.
- `visit_events`: append-only history for status and priority changes (priority reasons recorded).

## What is intentionally not included yet

This starter is a runnable MVP scaffold, **not a fully audited production clinical system**. Before live clinical use, add and validate: patient edit UI and tutor-contact policies, multi-clinic tenancy if needed, display privacy policy / ticket aliases, complete audit trail for patient creation and check-in, abuse protections/rate limits on the public queue, automated tests, incident response, data retention/deletion procedures, backup restore drills and a clinical triage protocol. There is no scheduling/QR booking integration, no staff provisioning UI, no true offline-mode, and no true push-subscription in this version. An externally accessible display exposes the permitted animal labels to anyone with the URL; consider access restriction or device authentication if this is not acceptable.

### Basic acceptance checks

- [ ] Reception can register and call a LOW-priority animal, but cannot reprioritize.
- [ ] Vet/admin can mark an animal URGENT with a reason.
- [ ] Multiple visits sort by priority, then server-created arrival time.
- [ ] TV shows no tutor names, notes, or staff editing controls.
- [ ] Completed/cancelled visits leave the active queue without being hard-deleted.
- [ ] TV refreshes after new arrivals and after internet connectivity is restored.
- [ ] Turning off reception PC does not interrupt TV or cloud application.

## Next implementation steps

Add form validation tests, clinic-specific queue policy, more sophisticated patient search/edit, and an explicit display access control strategy before production pilot.
