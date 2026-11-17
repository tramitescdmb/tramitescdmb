import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enviarCorreo, plantillaCorreo } from "@/lib/correo-microsoft";
import { escaparHtml } from "@/lib/avisos-correo";

const DESTINO_POR_DEFECTO = "tecnologia@cdmb.gov.co";

/**
 * Lo llama systemd (OnFailure=) cuando falla un temporizador o el servicio: envía un correo a TI.
 * Se protege con CRON_SECRET, igual que los demás procesos programados.
 */
export async function POST(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const unidad = (req.nextUrl.searchParams.get("unidad") ?? "").replace(/[^a-zA-Z0-9@._:-]/g, "").slice(0, 100);
  if (!unidad) return NextResponse.json({ error: "Falta la unidad." }, { status: 400 });

  // tramites-cron-vital.service → clave "vital" del registro de procesos programados.
  const clave = unidad.replace(/^tramites-(cron-)?/, "").replace(/\.(service|timer)$/, "");
  const ultima = await db.ejecucionProceso.findFirst({ where: { proceso: clave }, orderBy: { inicio: "desc" } }).catch(() => null);
  const cuando = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });
  const detalle = ultima
    ? `<p>Última ejecución registrada de «${escaparHtml(clave)}»: ${ultima.ok === false ? "con error" : ultima.ok ? "correcta" : "sin terminar"} (${ultima.inicio.toLocaleString("es-CO", { timeZone: "America/Bogota" })}).</p>${
        ultima.resumen ? `<p style="color:#555">${escaparHtml(ultima.resumen.slice(0, 600))}</p>` : ""
      }`
    : "";
  const html = plantillaCorreo(
    "Falló un proceso programado",
    `<p>La unidad <strong>${escaparHtml(unidad)}</strong> del servidor de SIC CDMB terminó con error el ${escaparHtml(cuando)}.</p>${detalle}<p>Para ver el detalle en el servidor: <code>journalctl -u ${escaparHtml(unidad)} -n 50</code></p>`
  );
  const destino = process.env.ALERTAS_SISTEMA_CORREO?.trim() || DESTINO_POR_DEFECTO;
  const r = await enviarCorreo({ para: destino.split(/[;,\s]+/).filter(Boolean), asunto: `SIC CDMB — falló ${unidad}`, html });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.mensaje }, { status: 502 });
  return NextResponse.json({ ok: true });
}
