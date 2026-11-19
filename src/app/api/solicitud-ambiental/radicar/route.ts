import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarLimiteEnvio } from "@/lib/anti-abuso";
import { datosPeticion, registrarAuditoriaDoc } from "@/lib/auditoria-doc";
import { radicarExpediente, type EntradaRadicacion } from "@/lib/radicar-expediente";
import { numeroSolicitudLibre, usuarioVentanillaVirtual } from "@/lib/solicitud-ambiental-db";

/** Un formulario de trámite completo, con documentos, no se llena en menos de esto. */
const MIN_MS_LLENADO = 15_000;

/**
 * Radicación en línea (vista pública «Solicitud ambiental»), sin cuenta. Crea el expediente de
 * Trámites 2.0 con las mismas reglas que la radicación de funcionarios y entrega un número de
 * solicitud aleatorio para consultar el estado junto con la cédula o el NIT.
 */
export async function POST(req: NextRequest) {
  const { ip, userAgent } = datosPeticion(req.headers);
  const limite = await verificarLimiteEnvio(ip, "solicitud-ambiental:radicar", { porHora: 5, porDia: 15 });
  if (!limite.permitido) return NextResponse.json({ error: limite.motivo }, { status: 429 });

  const body = (await req.json().catch(() => null)) as (EntradaRadicacion & { sitioWeb?: unknown; tsCarga?: unknown; aceptaTratamiento?: unknown }) | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  // Campo trampa: invisible para las personas; si viene lleno, es un robot. Se le responde como si nada.
  if (typeof body.sitioWeb === "string" && body.sitioWeb.trim() !== "") {
    return NextResponse.json({ numeroSolicitud: "SA-0000-0000", numero: "—" });
  }
  if (typeof body.tsCarga !== "number" || Date.now() - body.tsCarga < MIN_MS_LLENADO) {
    return NextResponse.json({ error: "Por favor revise el formulario e intente de nuevo." }, { status: 400 });
  }
  if (body.aceptaTratamiento !== true) {
    return NextResponse.json({ error: "Debe aceptar la declaración y la autorización de tratamiento de datos personales." }, { status: 400 });
  }

  // Solo trámites activos con procedimiento en SIC.
  const radicable = await db.tramiteTipo.count({ where: { id: String(body.tramiteTipoId ?? ""), activo: true, flujos: { some: {} } } });
  if (!radicable) return NextResponse.json({ error: "Este trámite no se puede radicar en línea." }, { status: 400 });

  try {
    const [usuario, numeroSolicitud] = await Promise.all([usuarioVentanillaVirtual(), numeroSolicitudLibre()]);
    const resultado = await radicarExpediente(body, { usuario, publico: { numeroSolicitud } });
    if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: resultado.status });

    await registrarAuditoriaDoc({
      entidad: "Expediente",
      entidadId: resultado.id,
      accion: "CREA",
      usuarioId: null,
      ip,
      userAgent,
      detalle: `Radicó ${resultado.numero} en línea (Solicitud ambiental, número de solicitud ${numeroSolicitud})`,
    });

    return NextResponse.json({ numeroSolicitud, numero: resultado.numero });
  } catch (err) {
    console.error("Solicitud ambiental en línea falló:", err);
    return NextResponse.json({ error: "No se pudo radicar la solicitud. Intente de nuevo en unos minutos." }, { status: 500 });
  }
}
