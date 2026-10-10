import Link from 'next/link';

export default function SinAcceso() {
  return (
    <div className="mx-auto mt-16 max-w-md">
      <h1 className="text-xl font-bold">Tu usuario no tiene acceso a esta sección</h1>
      <p className="mt-2 text-suave">Si lo necesitas, pide al administrador que ajuste tu rol.</p>
      <Link href="/" className="btn mt-6">Volver al inicio</Link>
    </div>
  );
}
