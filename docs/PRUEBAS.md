# Entorno de pruebas

Copia separada del sistema real, para probar sin riesgo. Rama: `pruebas`.

| Parte | Real | Prueba |
|---|---|---|
| Motor (Fly) | `lapa-casa-hostel` | `lapa-casa-test` (`backend/fly.test.toml`) |
| Base de datos | Supabase real | Supabase `lapa-test` (vacia) |
| Pagina (Vercel) | `lapacasario.com` | `lapa-casa-test.vercel.app` |

- La prueba no tiene claves de pago ni de calendarios reales.
- `frontend/vercel.json` de esta rama NO lleva las direcciones fijas del motor real; no copiarlo a `definitivo2026`.
