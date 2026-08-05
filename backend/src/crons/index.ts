// lapa-casa-hostel/backend/src/crons/index.ts
// ventana4
//
// sp_cleanup_expired_pending, sp_release_no_show y
// sp_process_flexible_conversion se movieron de node-cron a repeatable
// jobs de BullMQ (ver src/queues/cleanup.queue.ts y
// src/queues/flexible-conversion.queue.ts, registrados desde
// src/workers/index.ts) -- consolidando TODO el scheduling de procesos
// programados en un solo sistema, el que pide esta ventana, en vez de
// dos en paralelo (node-cron + BullMQ) haciendo lo mismo.
//
// node-cron se mantiene como dependencia solo para
// sync-ota-calendars.ts (Ventana 5, sin relación con estos 3
// procedimientos).

import './sync-ota-calendars';
