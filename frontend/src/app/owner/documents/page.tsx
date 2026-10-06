'use client';

//
// A verificação por documentos deixou de fazer parte do fluxo: depois de aceitar
// o termo, o administrador vai direto para a edição do apartamento e, quando
// estiver pronto, envia o anúncio para aprovação. Esta rota só redireciona.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OwnerDocumentsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/owner');
  }, [router]);
  return null;
}
