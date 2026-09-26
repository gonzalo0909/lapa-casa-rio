'use client';

//
// Formulário de nova senha a partir do link enviado por
// POST /owner-auth/forgot-password (token na query string, válido por 1h --
// ver owner-auth.routes.ts). useSearchParams precisa de um Suspense boundary
// para não quebrar o build estático (mesmo padrão recomendado pelo Next.js
// App Router).

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ownerAuthAPI } from '@/lib/owner-api';
import { handleAPIError } from '@/lib/api';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
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
      await ownerAuthAPI.resetPassword(token, newPassword);
      setSuccess(true);
      setTimeout(() => router.push('/owner/login'), 2000);
    } catch (err) {
      setError(handleAPIError(err, 'pt'));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <Alert variant="danger">
        <AlertDescription>
          Link inválido. Solicite um novo link em{' '}
          <Link href="/owner/forgot-password" className="underline">
            Esqueceu sua senha
          </Link>
          .
        </AlertDescription>
      </Alert>
    );
  }

  if (success) {
    return (
      <Alert variant="success">
        <AlertDescription>Senha redefinida com sucesso. Redirecionando para o login...</AlertDescription>
      </Alert>
    );
  }

  return (
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
        {loading ? 'Salvando...' : 'Redefinir senha'}
      </Button>
    </form>
  );
}

export default function OwnerResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm" padding="lg">
        <CardHeader>
          <CardTitle size="lg">Escolher nova senha</CardTitle>
          <CardDescription>Defina uma nova senha para acessar o painel.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
