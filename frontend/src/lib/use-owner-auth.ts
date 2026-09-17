'use client';

// lapa-casa-hostel/frontend/src/lib/use-owner-auth.ts
//
// Guard de autenticación para páginas de /owner. La sesión vive en dos
// cookies httpOnly emitidas por el backend:
//   - lch_owner:         access token (15 min) — enviado a todas las rutas
//   - lch_owner_refresh: refresh token (90 días) — solo enviado al endpoint
//                        POST /owner/login/refresh
//
// No hay token que leer en el cliente. Para saber si la sesión es válida
// se consulta GET /owner/me. Si devuelve 401 (access expirado), se intenta
// renovar vía /refresh antes de redirigir al login.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { APIError } from './api';
import { ownerAuthAPI, type OwnerProfile } from './owner-api';

export function useOwnerAuth() {
  const router = useRouter();
  const [profile, setProfile] = useState<OwnerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const res = await ownerAuthAPI.me();
        if (cancelled) {return;}
        if (res.data.mustChangePassword) {
          router.replace('/owner/change-password');
          return;
        }
        if (!res.data.termAcceptedAt) {
          router.replace('/owner/accept-terms');
          return;
        }
        setProfile(res.data);
        setLoading(false);
      } catch (err) {
        if (cancelled) {return;}

        // Si el access token expiró (401), intentar renovarlo con el refresh
        // token antes de forzar re-login. Con access TTL de 15 minutos esto
        // ocurrirá durante sesiones largas de trabajo — el usuario no debería
        // perder su sesión por eso.
        if (err instanceof APIError && err.statusCode === 401) {
          try {
            await ownerAuthAPI.refresh();
            if (cancelled) {return;}
            // Reintentar /me con el nuevo access token (ya en cookie)
            const retried = await ownerAuthAPI.me();
            if (cancelled) {return;}
            if (retried.data.mustChangePassword) {
              router.replace('/owner/change-password');
              return;
            }
            if (!retried.data.termAcceptedAt) {
              router.replace('/owner/accept-terms');
              return;
            }
            setProfile(retried.data);
            setLoading(false);
          } catch {
            // Refresh también falló (token expirado, revocado o cuenta
            // desactivada) — redirigir al login
            if (!cancelled) {
              router.replace('/owner/login');
            }
          }
          return;
        }

        setLoading(false);
      }
    }

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return { profile, loading };
}
