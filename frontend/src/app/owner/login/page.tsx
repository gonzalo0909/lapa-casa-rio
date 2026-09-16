'use client';

// lapa-casa-hostel/frontend/src/app/owner/login/page.tsx
//
// Login del panel de administradores de apartamento (owner-auth.routes.ts).
// Sesión vive en la cookie httpOnly `lch_owner`, seteada por el backend --
// esta página no guarda ningún token, solo llama al endpoint y redirige.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ownerAuthAPI } from '@/lib/owner-api';
import { handleAPIError } from '@/lib/api';

export default function OwnerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await ownerAuthAPI.login(email, password);
      if (res.data.mustChangePassword) {
        router.push('/owner/change-password');
      } else {
        router.push('/owner');
      }
    } catch (err) {
      setError(handleAPIError(err, 'pt'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm" padding="lg">
        <CardHeader>
          <CardTitle size="lg">Painel do Proprietário</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Senha"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && (
              <Alert variant="danger">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={loading} className="mt-2 w-full justify-center">
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
