'use client';

// lapa-casa-hostel/frontend/src/app/owner/change-password/page.tsx
//
// Cambio de contraseña obligatorio la primera vez que el dueño entra
// (mustChangePassword=true en apartment_owners -- ver owner-auth.routes.ts).
// También queda accesible después para cambiarla cuando quiera.
//
// No se valida la sesión al montar con un GET /owner/me porque ese llamado
// puede fallar por razones transitorias (cookie aún no propagada al momento
// de la primera render post-login, error de red, etc.) y generar un redirect
// a /login que el usuario vive como "el formulario aparece y desaparece".
//
// Si el POST de cambio devuelve 401 (access token expirado o inválido), se
// intenta renovar vía /refresh antes de redirigir al login: el acceso token
// dura 15 minutos pero el formulario podría mostrarse justo antes del vence
// (en /owner/* protegido) o el navegador no propagó la cookie a tiempo tras
// el redirect del login. El refresh token dura 90 días y es la salvaguarda
// en ambos casos.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ownerAuthAPI } from '@/lib/owner-api';
import { handleAPIError, APIError } from '@/lib/api';

export default function OwnerChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    setLoading(true);
    try {
      await ownerAuthAPI.changePassword(newPassword);
      router.push('/owner');
    } catch (err) {
      if (err instanceof APIError && err.statusCode === 401) {
        // Intentar renovar el access token con el refresh token antes de
        // forzar re-login. Cubre el caso en que el access token vence justo
        // mientras el usuario rellena el formulario o la cookie tarda en
        // propagarse tras el redirect del login.
        try {
          await ownerAuthAPI.refresh();
          await ownerAuthAPI.changePassword(newPassword);
          router.push('/owner');
        } catch {
          // Refresh también falló (refresh token expirado/revocado o cuenta
          // desactivada) → no hay sesión recuperable, volver al login.
          router.replace('/owner/login');
        }
        return;
      }
      setError(handleAPIError(err, 'pt'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm" padding="lg">
        <CardHeader>
          <CardTitle size="lg">Alterar senha</CardTitle>
          <CardDescription>
            Defina uma nova senha para continuar usando o painel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Nova senha"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              helperText="Mínimo 8 caracteres"
              required
            />
            <Input
              label="Confirmar nova senha"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            {error && (
              <Alert variant="danger">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={loading} className="mt-2 w-full justify-center">
              {loading ? 'Salvando...' : 'Salvar e continuar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
