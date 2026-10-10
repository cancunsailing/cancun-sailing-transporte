import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLICAS = ['/login', '/manifest.webmanifest', '/sw.js', '/icon', '/_next', '/favicon'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLICAS.some((p) => pathname.startsWith(p))) return NextResponse.next();
  const token = req.cookies.get('cs_sesion')?.value;
  if (token) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET || 'dev-secret-cambiar-en-produccion-000000'));
      return NextResponse.next();
    } catch {
      /* token inválido o vencido */
    }
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = pathname !== '/' ? `?siguiente=${encodeURIComponent(pathname)}` : '';
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
