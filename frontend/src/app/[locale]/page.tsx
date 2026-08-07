import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations('hero');

  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-6 py-16 text-center">
      <h1 className="font-display text-4xl font-semibold text-foreground sm:text-5xl">
        {t('title')}
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">{t('subtitle')}</p>
      <a
        href="#"
        className="rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition hover:opacity-90"
      >
        {t('checkAvailability')}
      </a>
    </main>
  );
}
