import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PERMISOS, sesion } from '@/lib/auth';
import { cargarManifiesto } from '@/lib/manifiesto';
import { fechaLarga } from '@/lib/fechas';

export const dynamic = 'force-dynamic';

// Las fuentes estándar de PDF solo cubren Latin-1: se reemplazan caracteres fuera de ese rango.
const limpio = (s: string | null | undefined) => String(s ?? '').replace(/[^\x20-\xFF]/g, '?');

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const s = await sesion();
  if (!s || !PERMISOS.verManifiestos.includes(s.rol)) return new NextResponse('Sin acceso', { status: 403 });
  const m = await cargarManifiesto(Number(params.id), s);
  if (!m) return new NextResponse('No encontrado', { status: 404 });

  const pdf = await PDFDocument.create();
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const tinta = rgb(0.08, 0.14, 0.17), suave = rgb(0.36, 0.42, 0.45), alerta = rgb(0.7, 0.33, 0.06);
  let page = pdf.addPage([612, 792]);
  let y = 750;
  const M = 48;
  const linea = (txt: string, size = 10, font = reg, color = tinta, x = M) => {
    if (y < 60) { page = pdf.addPage([612, 792]); y = 750; }
    page.drawText(limpio(txt), { x, y, size, font, color });
    y -= size + 5;
  };
  linea(`Cancun Sailing · Transporte ${m.numero}`, 18, bold);
  linea(`${fechaLarga(m.fecha)} · Llevar a Marina ${m.marina ?? '-'} · Tour ${m.horaTour ?? '-'}`, 11, reg, suave);
  y -= 4;
  linea(`Transportista: ${m.transportista ?? 'Por asignar'}    Unidad: ${m.unidad ?? 'Por asignar'}    Operador: ${m.operador ?? 'Por asignar'}`, 10);
  linea(`Pasajeros: ${m.pax}${m.infantes ? ` + ${m.infantes} infantes` : ''}    Pick ups: ${m.paradas.length}`, 10, bold);
  y -= 8;
  m.paradas.forEach((p, i) => {
    page.drawLine({ start: { x: M, y: y + 8 }, end: { x: 612 - M, y: y + 8 }, thickness: 0.5, color: rgb(0.85, 0.88, 0.89) });
    y -= 6;
    linea(`${i + 1}. ${p.hora ?? '--:--'}  ${p.hotel}  (${p.pax} pax${p.infantes ? ` + ${p.infantes} inf` : ''})`, 12, bold);
    if (p.zona) linea(p.zona, 9, reg, suave, M + 18);
    if (p.nota) linea(`Nota: ${p.nota}`, 9, bold, alerta, M + 18);
    for (const r of p.reservas) {
      linea(`${r.cliente}  ·  ${r.pax}${r.infantes ? `+${r.infantes}` : ''} pax  ·  ${r.producto}`, 9, bold, tinta, M + 18);
      linea([r.cupon && `Cupón ${r.cupon}`, r.hab && `Hab ${r.hab}`, r.agencia, r.rep && `Rep ${r.rep}`, r.reserva].filter(Boolean).join('  ·  '), 8, reg, suave, M + 30);
    }
    y -= 4;
  });
  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="manifiesto-${m.fecha}-transporte-${m.numero}.pdf"`,
    },
  });
}
