'use client';

//
// Pedido de link de reset de senha (owner-auth.routes.ts POST /forgot-password).
// A resposta do backend é sempre genérica (exista ou não o email) para não
// confirmar quais emails estão cadastrados -- então esta página sempre mostra
// a mesma mensagem de sucesso, nunca um erro de "email não encontrado".

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ownerAuthAPI } from '@/lib/owner-api';
import { handleAPIError } from '@/lib/api';

export default function OwnerForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await ownerAuthAPI.forgotPassword(email);
      setSent(true);
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
          <CardTitle size="lg">Redefinir senha</CardTitle>
          <CardDescription>
            Informe o email da sua conta e enviaremos um link para redefinir sua senha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="flex flex-col gap-4">
              <Alert variant="success">
                <AlertDescription>
                  Se o email existir na nossa base, você vai receber um link para redefinir sua
                  senha em instantes. Verifique também a caixa de spam.
                </AlertDescription>
              </Alert>
              <Link href="/owner/login" className="text-center text-sm text-muted-foreground hover:underline">
                Voltar ao login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              {error && (
                <Alert variant="danger">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" disabled={loading} className="mt-2 w-full justify-center">
                {loading ? 'Enviando...' : 'Enviar link de redefinição'}
              </Button>

              <Link href="/owner/login" className="text-center text-sm text-muted-foreground hover:underline">
                Voltar ao login
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
