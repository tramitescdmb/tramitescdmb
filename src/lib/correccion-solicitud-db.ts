import { db } from "@/lib/db";
import { correoValido, direccionesSuprimidas, enSegundoPlano, escaparHtml, parametros, urlBasePlataforma } from "@/lib/avisos-correo";
import { enviarCorreo, plantillaCorreo } from "@/lib/correo-microsoft";
import { formatearFechaLarga } from "@/lib/fecha";

/**
 * Correo al ciudadano con lo que debe corregir. Va al correo del solicitante y al de su cuenta
 * ciudadana (si son distintos). Se envía aunque el aviso general de trámites esté apagado: es un
 * requerimiento de la entidad, no un aviso informativo.
 */
export function avisarCorreccionAlCiudadano(requerimientoId: string) {
  enSegundoPlano(async () => {
    const r = await db.requerimientoCorreccion.findUnique({
      where: { id: requerimientoId },
      select: {
        mensaje: true,
        plazoHasta: true,
        items: { select: { titulo: true, motivo: true } },
        expediente: {
          select: {
            id: true,
            numero: true,
            codigoSolicitudPublica: true,
            solicitanteNombre: true,
            solicitanteEmail: true,
            tramiteTipo: { select: { nombre: true } },
            cuentaCiudadana: { select: { correo: true } },
          },
        },
      },
    });
    if (!r) return;
    const e = r.expediente;
    const correos = [...new Set([e.solicitanteEmail?.trim().toLowerCase(), e.cuentaCiudadana?.correo].filter(correoValido))];
    if (correos.length === 0) return;
    const suprimidas = await direccionesSuprimidas(correos);
    const { urlPlataforma } = await parametros();
    const base = urlBasePlataforma(urlPlataforma);
    const ruta = `/solicitud-ambiental/ingresar?siguiente=${encodeURIComponent(`/solicitud-ambiental/mis-solicitudes/${e.id}`)}`;
    const lista = r.items.map((i) => `<li><strong>${escaparHtml(i.titulo)}</strong>: ${escaparHtml(i.motivo)}</li>`).join("");
    const cuerpo = `
      <p>${escaparHtml(e.solicitanteNombre)}:</p>
      <p>La CDMB revisó su solicitud <strong>${escaparHtml(e.codigoSolicitudPublica ?? "")}</strong> (expediente ${escaparHtml(e.numero)}, ${escaparHtml(e.tramiteTipo.nombre)}) y necesita que corrija o complete lo siguiente:</p>
      <ul>${lista}</ul>
      ${r.mensaje ? `<p>${escaparHtml(r.mensaje)}</p>` : ""}
      <p><strong>Plazo:</strong> hasta el ${escaparHtml(formatearFechaLarga(r.plazoHasta))}.</p>
      <p>No tiene que empezar de nuevo: ingrese a <strong>Mis solicitudes</strong> con este correo y cargue solo estos documentos. Si no ve la solicitud, agréguela con el número ${escaparHtml(e.codigoSolicitudPublica ?? "")}.</p>`;
    const html = plantillaCorreo("Su solicitud requiere corrección", cuerpo, base ? { texto: "Ir a Mis solicitudes", url: `${base}${ruta}` } : undefined);
    for (const para of correos) {
      if (suprimidas.has(para)) continue;
      const res = await enviarCorreo({ para: [para], asunto: `Corrija su solicitud ${e.codigoSolicitudPublica ?? e.numero} — CDMB`, html });
      if (!res.ok) console.error("No se pudo enviar el requerimiento de corrección:", res.mensaje);
    }
  });
}
