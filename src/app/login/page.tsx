import { LoginForm } from './LoginForm';

export const metadata = { title: 'Entrar · Transporte Cancun Sailing' };

export default function LoginPage({ searchParams }: { searchParams: { siguiente?: string } }) {
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="text-2xl font-bold">Transporte</h1>
      <p className="mb-6 text-suave">Logística de pasajeros de Cancun Sailing</p>
      <LoginForm siguiente={searchParams.siguiente ?? '/'} />
    </div>
  );
}
