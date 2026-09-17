'use client';

// lapa-casa-hostel/frontend/src/components/owner/owner-nav.tsx
//
// Barra de navegação do painel do administrador de apartamento.
// Usada em todas as páginas autenticadas de /owner.

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ownerAuthAPI } from '@/lib/owner-api';

interface OwnerNavProps {
  fullName: string;
}

const NAV_LINKS = [
  { href: '/owner', label: 'Apartamentos' },
  { href: '/owner/documents', label: 'Documentos' },
  { href: '/owner/contract', label: 'Contrato' },
];

export function OwnerNav({ fullName }: OwnerNavProps) {
  const pathname = usePathname();
  const router = useRouter();

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
