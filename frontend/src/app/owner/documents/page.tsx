'use client';

//
// Página de verificación de identidad del administrador.
// El owner sube:
//   - CPF o CNPJ (foto/scan del documento)
//   - Comprobante de propiedad (escritura, contrato, etc.)
// El admin los revisa y aprueba/rechaza desde el panel admin.
// El badge de verificación aparece en el dashboard principal.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useOwnerAuth } from '@/lib/use-owner-auth';
import { ownerDocumentsAPI, type OwnerDocument } from '@/lib/owner-api';
import { handleAPIError } from '@/lib/api';
import { OwnerNav } from '@/components/owner/owner-nav';

type DocType = 'cpf_cnpj' | 'proof_ownership' | 'other';

const DOC_TYPE_LABELS: Record<DocType, { label: string; hint: string }> = {
  cpf_cnpj: {
    label: 'CPF / CNPJ',
    hint: 'Foto o escáner del documento de identidad (CPF para persona física, CNPJ para empresa)',
  },
  proof_ownership: {
    label: 'Comprobante de propiedad',
    hint: 'Escritura, contrato de compraventa, IPTU o documento equivalente que acredite la titularidad del inmueble',
  },
  other: {
    label: 'Otro documento',
    hint: 'Cualquier documento complementario que el administrador desee adjuntar',
  },
};

const STATUS_INFO: Record<string, { label: string; color: string; desc: string }> = {
  pending: {
    label: '⏳ Verificação pendente',
    color: 'bg-amber-50 border-amber-200 text-amber-800',
    desc: 'Seus documentos estão aguardando revisão. Normalmente levamos até 2 dias úteis.',
  },
  verified: {
    label: '✓ Conta verificada',
    color: 'bg-green-50 border-green-200 text-green-800',
    desc: 'Seus documentos foram aprovados. Você tem o badge "Verificado" no seu perfil.',
  },
  rejected: {
    label: '✗ Documentos rejeitados',
    color: 'bg-red-50 border-red-200 text-red-800',
    desc: 'Seus documentos foram rejeitados. Envie novos arquivos para solicitar uma nova análise.',
  },
};

export default function OwnerDocumentsPage() {
  const { profile, loading: authLoading } = useOwnerAuth();
  const [verificationStatus, setVerificationStatus] = useState<string>('pending');
  const [documents, setDocuments] = useState<OwnerDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<DocType | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRefs = useRef<Partial<Record<DocType, HTMLInputElement | null>>>({});

  useEffect(() => {
    if (!profile) { return; }
    ownerDocumentsAPI
      .list()
      .then((res) => {
        setVerificationStatus(res.data.verificationStatus);
        setDocuments(res.data.documents);
      })
      .catch((err) => setError(handleAPIError(err, 'pt')))
      .finally(() => setLoadingDocs(false));
  }, [profile]);

  const handleUpload = async (docType: DocType, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { return; }

    setUploadError(null);
    setUploadingType(docType);
    try {
      await ownerDocumentsAPI.upload(file, docType);
      // Recargar lista
      const res = await ownerDocumentsAPI.list();
      setVerificationStatus(res.data.verificationStatus);
      setDocuments(res.data.documents);
    } catch (err) {
      setUploadError(handleAPIError(err, 'pt'));
    } finally {
      setUploadingType(null);
      const input = fileInputRefs.current[docType];
      if (input) { input.value = ''; }
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      await ownerDocumentsAPI.delete(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      setError(handleAPIError(err, 'pt'));
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" text="Carregando..." />
      </div>
    );
  }

  if (!profile) { return null; }

  // noUncheckedIndexedAccess hace que Record<string,T>[string] sea T|undefined;
  // el fallback garantiza que siempre haya un valor definido.
  const statusInfo = STATUS_INFO[verificationStatus] ?? STATUS_INFO['pending'] ?? { label: '', color: '', desc: '' };
  const canUpload = verificationStatus !== 'verified';

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <OwnerNav fullName={profile.fullName} />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Verificação de identidade</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Envie os documentos abaixo para ativar o badge <strong>Verificado</strong> no seu perfil.
        </p>
      </div>

      {/* Status de verificación */}
      <div className={`mb-6 rounded-lg border px-4 py-3 text-sm font-medium ${statusInfo.color}`}>
        <p className="font-semibold">{statusInfo.label}</p>
        <p className="mt-0.5 font-normal opacity-80">{statusInfo.desc}</p>
        {/* Notas del admin si hay rechazo */}
        {verificationStatus === 'rejected' && documents.some((d) => d.reviewNotes) && (
          <p className="mt-2 italic">
            Motivo: {documents.find((d) => d.reviewNotes)?.reviewNotes}
          </p>
        )}
      </div>

      {error && (
        <Alert variant="danger" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {uploadError && (
        <Alert variant="danger" className="mb-6">
          <AlertDescription>{uploadError}</AlertDescription>
        </Alert>
      )}

      {/* Documentos requeridos */}
      <div className="mb-6 flex flex-col gap-4">
        {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map((type) => {
          const info = DOC_TYPE_LABELS[type];
          const uploaded = documents.filter((d) => d.docType === type);
          const isUploadingThis = uploadingType === type;
          return (
            <Card key={type}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle size="sm">{info.label}</CardTitle>
                  {uploaded.length > 0 && (
                    <span className="text-xs text-green-700 font-medium">✓ Enviado</span>
                  )}
                  {uploaded.length === 0 && type !== 'other' && (
                    <span className="text-xs text-amber-600 font-medium">Pendente</span>
                  )}
                </div>
                <CardDescription>{info.hint}</CardDescription>
              </CardHeader>

              {uploaded.length > 0 && (
                <CardContent className="pt-0">
                  <ul className="flex flex-col gap-2">
                    {uploaded.map((doc) => (
                      <li key={doc.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground truncate max-w-xs">
                          {doc.originalName ?? 'documento'}
                        </span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {new Date(doc.uploadedAt).toLocaleDateString('pt-BR')}
                          </span>
                          {canUpload && (
                            <button
                              onClick={() => handleDelete(doc.id)}
                              className="text-xs text-red-600 hover:underline"
                            >
                              Remover
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              )}

              {canUpload && (
                <CardContent className="pt-0">
                  <input
                    ref={(el) => { fileInputRefs.current[type] = el; }}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    onChange={(e) => handleUpload(type, e)}
                    disabled={uploadingType !== null}
                    className="hidden"
                    id={`doc-upload-${type}`}
                  />
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingType !== null}
                      onClick={() => fileInputRefs.current[type]?.click()}
                    >
                      {isUploadingThis
                        ? 'Enviando...'
                        : uploaded.length > 0
                          ? 'Enviar outro arquivo'
                          : 'Selecionar arquivo'}
                    </Button>
                    {isUploadingThis && <LoadingSpinner size="sm" />}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">JPG, PNG, WEBP ou PDF · Máx. 10 MB</p>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {loadingDocs && <LoadingSpinner centered text="Carregando documentos..." />}

      {/* Aviso de qué pasa después */}
      <p className="mt-8 text-center text-xs text-muted-foreground">
        Após o envio, nossa equipe revisará os documentos em até 2 dias úteis.
        Dúvidas?{' '}
        <Link href="mailto:lapacasa22@gmail.com" className="underline">
          Entre em contato
        </Link>
        .
      </p>
    </div>
  );
}
