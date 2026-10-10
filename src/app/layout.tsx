import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Navegacion } from '@/components/Navegacion';
import { sesion } from '@/lib/auth';
import { RegistrarSW } from '@/components/RegistrarSW';

export const metadata: Metadata = {
  title: 'Transporte · Cancun Sailing',
  description: 'Logística de transporte de pasajeros de Cancun Sailing',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Transporte CS', statusBarStyle: 'default' },
};

export const viewport: Viewport = { themeColor: '#14232b', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await sesion();
  return (
    <html lang="es">
      <body>
        {s && <Navegacion sesion={s} />}
        <main className="mx-auto max-w-7xl px-4 pb-16 pt-6">{children}</main>
        <RegistrarSW />
      </body>
    </html>
  );
}
