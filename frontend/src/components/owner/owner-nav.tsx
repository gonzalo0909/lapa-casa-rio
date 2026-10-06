'use client';

//
// Barra de navegação do painel do administrador de apartamento.
// Usada em todas as páginas autenticadas de /owner.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ownerAuthAPI, ownerMessagesAPI } from '@/lib/owner-api';

interface OwnerNavProps {
  fullName: string;
}

const NAV_LINKS = [
  { href: '/owner', label: 'Apartamentos' },
  { href: '/owner/messages', label: 'Mensagens' },
  { href: '/owner/contract', label: 'Contrato' },
];

export function OwnerNav({ fullName }: OwnerNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  // Mensagens não lidas da equipe (badge no menu); consulta a cada 30 s
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      ownerMessagesAPI
        .unread()
        .then((res) => { if (!cancelled) {setUnread(res.data.unread);} })
        .catch(() => { /* badge opcional */ });
    };
    load();
    const id = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await ownerAuthAPI.logout();
    } finally {
      router.push('/owner/login');
    }
  };

  return (
    <nav className="mb-8 flex items-center justify-between border-b border-border pb-4">
      {/* Logo / nome */}
      <span className="text-sm font-medium text-muted-foreground truncate max-w-[160px]">
        {fullName}
      </span>

      {/* Links */}
      <div className="flex items-center gap-6">
        {NAV_LINKS.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`text-sm font-medium transition-colors ${
                active
                  ? 'text-foreground underline underline-offset-4'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
              {href === '/owner/messages' && unread > 0 && (
                <span className="ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{unread}</span>
              )}
            </Link>
          );
        })}

        <button
          onClick={handleLogout}
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Sair
        </button>
      </div>
    </nav>
  );
}
