import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export type Rol = 'admin' | 'coordinador' | 'finanzas' | 'transportista' | 'consulta';
export type Sesion = { id: string; email: string; nombre: string; rol: Rol; transportistaId: number | null };

export const COOKIE = 'cs_sesion';
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET || 'dev-secret-cambiar-en-produccion-000000');

export const ROL_NOMBRE: Record<Rol, string> = {
  admin: 'Admin',
  coordinador: 'Coordinación de operación',
  finanzas: 'Finanzas',
  transportista: 'Transportista',
  consulta: 'Consulta',
};

/** Qué puede hacer cada rol. */
export const PERMISOS = {
  verOperacion: ['admin', 'coordinador', 'finanzas', 'consulta'] as Rol[],
  editarOperacion: ['admin', 'coordinador'] as Rol[],
  editarCatalogos: ['admin'] as Rol[],
  verCatalogos: ['admin', 'coordinador', 'finanzas', 'consulta'] as Rol[],
  administrarUsuarios: ['admin'] as Rol[],
  revisarReglas: ['admin'] as Rol[],
  verManifiestos: ['admin', 'coordinador', 'finanzas', 'consulta', 'transportista'] as Rol[],
};

export async function crearToken(s: Sesion): Promise<string> {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(secret());
}

export async function leerToken(token: string | undefined): Promise<Sesion | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as Sesion;
  } catch {
    return null;
  }
}

export async function sesion(): Promise<Sesion | null> {
  return leerToken(cookies().get(COOKIE)?.value);
}

/** Exige sesión (y opcionalmente un rol permitido); si no, redirige. */
export async function requerir(roles?: Rol[]): Promise<Sesion> {
  const s = await sesion();
  if (!s) redirect('/login');
  if (roles && !roles.includes(s.rol)) redirect('/sin-acceso');
  return s;
}

export function puede(s: Sesion | null, roles: Rol[]): boolean {
  return !!s && roles.includes(s.rol);
}
