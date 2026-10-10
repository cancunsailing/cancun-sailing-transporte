'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { iniciarSesion } from './actions';

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primario w-full" disabled={pending}>
      {pending ? 'Entrando…' : 'Entrar'}
    </button>
  );
}

export function LoginForm({ siguiente }: { siguiente: string }) {
  const [estado, accion] = useFormState(iniciarSesion, {});
  return (
    <form action={accion} className="tarjeta grid gap-4 p-5">
      <input type="hidden" name="siguiente" value={siguiente} />
      <div>
        <label className="etiqueta" htmlFor="email">Correo</label>
        <input id="email" name="email" type="email" required autoComplete="username" className="campo" />
      </div>
      <div>
        <label className="etiqueta" htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className="campo" />
      </div>
      {estado?.error && <p className="text-sm font-semibold text-alerta">{estado.error}</p>}
      <Enviar />
    </form>
  );
}
