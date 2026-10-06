'use client';

//
// Chat do administrador de apartamento com a equipe da plataforma.
// Um único tópico por administrador; atualiza sozinho a cada 8 s.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useOwnerAuth } from '@/lib/use-owner-auth';
import { ownerMessagesAPI, type OwnerChatMessage } from '@/lib/owner-api';
import { handleAPIError } from '@/lib/api';
import { OwnerNav } from '@/components/owner/owner-nav';

function fmt(d: string): string {
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function OwnerMessagesPage() {
  const { profile, loading: authLoading } = useOwnerAuth();
  const [messages, setMessages] = useState<OwnerChatMessage[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await ownerMessagesAPI.list();
      setMessages(res.data.messages);
    } catch (err) {
      setError(handleAPIError(err, 'pt'));
    }
  }, []);

  useEffect(() => {
    if (!profile) {return;}
    void load();
    const id = setInterval(() => { if (!document.hidden) {void load();} }, 8000);
    return () => clearInterval(id);
  }, [profile, load]);

  useEffect(() => {
    const el = threadRef.current;
    if (el && stickToBottom.current) {el.scrollTop = el.scrollHeight;}
  }, [messages]);

  const handleScroll = () => {
    const el = threadRef.current;
    if (el) {stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;}
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) {return;}
    setSending(true);
    setError(null);
    try {
      await ownerMessagesAPI.send(body);
      setText('');
      stickToBottom.current = true;
      await load();
    } catch (err) {
      setError(handleAPIError(err, 'pt'));
    } finally {
      setSending(false);
    }
  };

  if (authLoading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" text="Carregando..." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <OwnerNav fullName={profile.fullName} />

      <Card>
        <CardHeader>
          <CardTitle size="sm">Mensagens</CardTitle>
          <CardDescription>Converse diretamente com a equipe da Lapa Casa.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="danger" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div
            ref={threadRef}
            onScroll={handleScroll}
            className="flex h-[50vh] flex-col gap-2 overflow-y-auto rounded-md border border-neutral-200 bg-neutral-50 p-3"
          >
            {!messages && <LoadingSpinner centered text="Carregando mensagens..." />}
            {messages && messages.length === 0 && (
              <p className="m-auto text-sm text-neutral-500">Nenhuma mensagem ainda. Escreva a primeira.</p>
            )}
            {messages?.map((m) => (
              <div
                key={m.id}
                className={`max-w-[80%] whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-sm ${
                  m.sender === 'owner'
                    ? 'self-end bg-neutral-900 text-white'
                    : 'self-start border border-neutral-200 bg-white text-neutral-900'
                }`}
              >
                {m.sender === 'admin' && <p className="mb-0.5 text-[10px] font-semibold uppercase text-neutral-500">Equipe Lapa Casa</p>}
                {m.body}
                <p className="mt-1 text-[10px] opacity-60">{fmt(m.created_at)}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleSend} className="mt-3 flex flex-col gap-2">
            <Textarea
              label="Nova mensagem"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Escreva sua mensagem..."
            />
            <Button type="submit" disabled={sending || !text.trim()} className="self-end">
              {sending ? 'Enviando...' : 'Enviar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
