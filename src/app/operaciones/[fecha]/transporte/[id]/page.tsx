import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PERMISOS, requerir } from '@/lib/auth';
import { cargarManifiesto, textoWhatsApp } from '@/lib/manifiesto';
import { fechaLarga } from '@/lib/fechas';
import { CopiarTexto } from './CopiarTexto';

export const dynamic = 'force-dynamic';

export default async function ManifiestoPage({ params }: { params: { fecha: string; id: string } }) {
  const s = await requerir(PERMISOS.verManifiestos);
  const m = await cargarManifiesto(Number(params.id), s);
  if (!m) notFound();
  const texto = textoWhatsApp(m);
  return (
    <div className="grid max-w-3xl gap-5">
      {s.rol !== 'transportista' && (
        <Link href={`/operaciones/${params.fecha}`} className="text-sm font-semibold text-suave hover:text-tinta">← Operación</Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Manifiesto · Transporte {m.numero}</h1>
          <p className="text-suave">{fechaLarga(m.fecha)} · Llevar a Marina {m.marina} · Tour {m.horaTour}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn-primario" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer">Compartir por WhatsApp</a>
          <a className="btn" href={`/api/manifiesto/${m.id}/pdf`}>Descargar PDF</a>
          <CopiarTexto texto={texto} />
        </div>
      </div>
      <dl className="tarjeta grid gap-3 p-4 sm:grid-cols-4">
        <div><dt className="etiqueta">Transportista</dt><dd>{m.transportista ?? 'Por asignar'}</dd></div>
        <div><dt className="etiqueta">Unidad</dt><dd>{m.unidad ?? 'Por asignar'}</dd></div>
        <div><dt className="etiqueta">Operador</dt><dd>{m.operador ?? 'Por asignar'}</dd></div>
        <div><dt className="etiqueta">Pasajeros</dt><dd className="tabular">{m.pax}{m.infantes ? ` + ${m.infantes} infantes` : ''}</dd></div>
      </dl>
      <ol className="grid gap-3">
        {m.paradas.map((p, i) => (
          <li key={i} className="tarjeta p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-bold"><span className="font-mono text-suave">{p.hora ?? '—'}</span> · {i + 1}. {p.hotel}</h2>
              <span className="tabular font-semibold">{p.pax}{p.infantes ? ` +${p.infantes}` : ''} pax</span>
            </div>
            <p className="text-xs text-suave">{p.zona}</p>
            {p.nota && <p className="mt-1 text-sm font-semibold text-alerta">{p.nota}</p>}
            <table className="tabla mt-2">
              <thead><tr><th>Cliente</th><th>Cupón</th><th>Hab</th><th>Producto</th><th>Agencia · Rep</th><th className="text-right">Pax</th></tr></thead>
              <tbody>
                {p.reservas.map((r) => (
                  <tr key={r.reserva}><td className="font-semibold">{r.cliente}<div className="font-mono text-xs font-normal text-suave">{r.reserva}</div></td><td className="font-mono text-xs">{r.cupon ?? '—'}</td><td className="font-mono text-xs">{r.hab ?? '—'}</td><td>{r.producto}</td><td className="text-xs">{r.agencia}{r.rep ? <div className="text-suave">{r.rep}</div> : null}</td><td className="tabular text-right">{r.pax}{r.infantes ? ` +${r.infantes}` : ''}</td></tr>
                ))}
              </tbody>
            </table>
          </li>
        ))}
      </ol>
    </div>
  );
}
