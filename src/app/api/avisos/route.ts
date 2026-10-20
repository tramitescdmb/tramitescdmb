import { NextResponse } from "next/server";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { contarMemorandos, contextoMemorandos } from "@/lib/memorandos";
import { contarPendientesBuzonSgdea } from "@/lib/firmas-sgdea";

type Aviso = { clave: string; titulo: string; detalle?: string; href: string; alerta: boolean; cantidad: number };

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  const avisos: Aviso[] = [];

  if (puedeAccederCorrespondencia(permisos)) {
    const [memos, firmas] = await Promise.all([contextoMemorandos(session.userId, permisos).then(contarMemorandos), contarPendientesBuzonSgdea(session.userId)]);
    if (memos.porResponder > 0) {
      avisos.push({
        clave: "memos-responder",
        titulo: `${memos.porResponder} memorando(s) por responder`,
        detalle: memos.vencidos > 0 ? `${memos.vencidos} con plazo vencido` : "Dentro del plazo",
        href: "/correspondencia/memorandos?vista=por-responder",
        alerta: memos.vencidos > 0,
        cantidad: memos.porResponder,
      });
    }
    if (memos.sinLeer > 0) {
      avisos.push({
        clave: "memos-sin-leer",
        titulo: `${memos.sinLeer} memorando(s) sin leer`,
        href: "/correspondencia/memorandos?vista=sin-leer",
        alerta: false,
        cantidad: memos.sinLeer,
      });
    }
    if (firmas.listos > 0) {
      avisos.push({
        clave: "firmas-sgdea",
        titulo: `${firmas.listos} documento(s) del SGDEA para firmar`,
        href: "/correspondencia/buzon",
        alerta: true,
        cantidad: firmas.listos,
      });
    }
  }

  return NextResponse.json({ avisos });
}
