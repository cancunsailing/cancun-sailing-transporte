'use client';
import { useState } from 'react';

export function CopiarTexto({ texto }: { texto: string }) {
  const [hecho, setHecho] = useState(false);
  return (
    <button
      type="button"
      className="btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setHecho(true);
          setTimeout(() => setHecho(false), 2000);
        } catch {
          /* el navegador no permitió copiar */
        }
      }}
    >
      {hecho ? 'Copiado' : 'Copiar texto'}
    </button>
  );
}
