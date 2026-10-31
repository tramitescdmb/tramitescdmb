import { db } from "@/lib/db";
import { prepararEnvio } from "@/lib/correo-microsoft";
import { ENCABEZADO_ENVIO } from "@/lib/avisos-correo";

export type AnalisisRebote = { envio: string | null; codigo: string | null; destinatarios: string[]; diagnostico: string | null; suprimir: boolean };

const CORTE_ENCABEZADOS = /(Original message headers|Encabezados del mensaje original|Encabezados de mensaje original|Original-Envelope-Id|^Received:)/im;
const CUENTAS_SISTEMA = /^(postmaster|mailer-daemon|microsoftexchange[0-9a-f]*|no-?reply)@/i;
const CODIGO_SUPRESION = /^5\.(1\.\d{1,3}|4\.1|4\.4)$/;
const FRASE_INEXISTENTE = /(does ?n[o']t exist|wasn't found|was not found|not found|unknown user|user unknown|no such user|mailbox unavailable|invalid recipient|no existe|no se encontr)/i;
const ASUNTO_REBOTE = /^(undeliverable|no se puede entregar|no se pudo entregar|non remis|unzustellbar|delivery status notification \(failure\)|mail delivery failed|returned mail|undelivered mail)/i;

export function esInformeNoEntrega(m: { asunto: string; clase: string | null }): boolean {
  if (m.clase) return /^REPORT\..*\.NDR$/i.test(m.clase);
  return ASUNTO_REBOTE.test(m.asunto.trim());
}

export function analizarRebote(texto: string, excluir: string[] = []): AnalisisRebote {
  const envio = texto.match(new RegExp(`${ENCABEZADO_ENVIO}:\\s*([0-9a-f-]{36})`, "i"))?.[1]?.toLowerCase() ?? null;
  const corte = texto.search(CORTE_ENCABEZADOS);
  const cuerpo = corte > 0 ? texto.slice(0, corte) : texto;
  const codigo = [...cuerpo.matchAll(/(?<![\d.])([45])\.(\d)\.(\d{1,3})(?![\d.])/g)].map((m) => `${m[1]}.${m[2]}.${m[3]}`)[0] ?? null;
  const propios = new Set(excluir.map((c) => c.toLowerCase()));
  const destinatarios = [
    ...new Set([...cuerpo.matchAll(/[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g)].map((m) => m[0].toLowerCase().replace(/^'+|'+$/g, ""))),
  ].filter((c) => !propios.has(c) && !CUENTAS_SISTEMA.test(c));
  const linea =
    cuerpo.match(/(Remote server returned|El servidor remoto devolvi[oó]|Servidor remoto devolvi[oó]|Diagnostic-Code)[^\n]*/i)?.[0] ??
    (codigo ? cuerpo.split(/\r?\n/).find((l) => l.includes(codigo)) : undefined);
  return {
    envio,
    codigo,
    destinatarios,
    diagnostico: linea ? linea.replace(/\s+/g, " ").trim().slice(0, 400) : null,
    suprimir: codigo !== null && codigo.startsWith("5") && (CODIGO_SUPRESION.test(codigo) || FRASE_INEXISTENTE.test(cuerpo)),
  };
}

type MensajeGraph = {
  id: string;
  subject?: string | null;
  receivedDateTime: string;
  body?: { content?: string | null; contentType?: string | null } | null;
  singleValueExtendedProperties?: { id: string; value: string }[];
};

export type ResultadoRebotes = { cuenta: string; revisados: number; rebotes: number; marcados: number; suprimidas: number; movidos: number; ok: boolean; mensaje?: string };

const CLASE_MENSAJE = "String 0x001A";
const VENTANA_INICIAL_MS = 7 * 86_400_000;
const VENTANA_COINCIDENCIA_MS = 30 * 86_400_000;
const MAX_PAGINAS = 10;

function textoPlano(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ");
}

async function filasDelRebote(analisis: AnalisisRebote, asunto: string): Promise<{ filas: { id: string; destinatario: string; estado: string }[]; exacta: boolean }> {
  if (analisis.envio) {
    const filas = await db.correoEnviado.findMany({ where: { envio: analisis.envio }, select: { id: true, destinatario: true, estado: true } });
    if (filas.length) return { filas, exacta: true };
  }
  if (analisis.destinatarios.length === 0) return { filas: [], exacta: false };
  const recientes = await db.correoEnviado.findMany({
    where: { destinatario: { in: analisis.destinatarios }, estado: { in: ["ENVIADO", "REBOTADO"] }, createdAt: { gte: new Date(Date.now() - VENTANA_COINCIDENCIA_MS) } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, destinatario: true, estado: true, asunto: true, envio: true },
  });
  const porAsunto = recientes.filter((f) => f.asunto && asunto.includes(f.asunto.slice(0, 120)));
  if (porAsunto.length) {
    const envio = porAsunto[0]!.envio;
    return { filas: envio ? porAsunto.filter((f) => f.envio === envio) : porAsunto.slice(0, 1), exacta: true };
  }
  const masReciente = new Map<string, (typeof recientes)[number]>();
  for (const f of recientes) if (!masReciente.has(f.destinatario)) masReciente.set(f.destinatario, f);
  return { filas: [...masReciente.values()], exacta: false };
}

export async function procesarRebotesCuenta(cuenta: { id: string; nombre: string; rebotesHasta: Date | null; createdAt: Date }): Promise<ResultadoRebotes> {
  const r: ResultadoRebotes = { cuenta: cuenta.nombre, revisados: 0, rebotes: 0, marcados: 0, suprimidas: 0, movidos: 0, ok: true };
  const cliente = await prepararEnvio(cuenta.id);
  if (!cliente) return { ...r, ok: false, mensaje: "La cuenta no tiene claves vigentes." };
  const buzon = `/users/${encodeURIComponent(cliente.remitente)}`;
  const desde = cuenta.rebotesHasta ?? new Date(Math.max(cuenta.createdAt.getTime(), Date.now() - VENTANA_INICIAL_MS));
  let hasta = desde;
  const consulta = [
    `$filter=${encodeURIComponent(`receivedDateTime gt ${desde.toISOString()}`)}`,
    `$orderby=${encodeURIComponent("receivedDateTime asc")}`,
    "$top=50",
    `$select=${encodeURIComponent("id,subject,receivedDateTime,body")}`,
    `$expand=${encodeURIComponent(`singleValueExtendedProperties($filter=id eq '${CLASE_MENSAJE}')`)}`,
  ].join("&");
  const guardarAvance = async () => {
    if (hasta > desde) await db.cuentaCorreo.update({ where: { id: cuenta.id }, data: { rebotesHasta: hasta } });
  };
  let ruta: string | null = `${buzon}/mailFolders/inbox/messages?${consulta}`;
  for (let pagina = 0; ruta && pagina < MAX_PAGINAS; pagina++) {
    const respuesta = await cliente.graph(ruta, { headers: { Prefer: 'outlook.body-content-type="text"' } });
    let falla: string | null = null;
    if (!(respuesta instanceof Response)) falla = respuesta.error;
    else if (respuesta.status === 403) falla = "La aplicación no tiene permiso de lectura del buzón (Mail.ReadWrite).";
    else if (!respuesta.ok) {
      const cuerpo = (await respuesta.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
      falla = `Microsoft 365 respondió ${respuesta.status}${cuerpo.error?.code ? ` · ${cuerpo.error.code}` : ""}: ${cuerpo.error?.message ?? "sin detalle"}`;
    }
    if (falla || !(respuesta instanceof Response)) {
      await guardarAvance();
      return { ...r, ok: false, mensaje: falla ?? "Sin respuesta de Microsoft 365." };
    }
    const datos = (await respuesta.json()) as { value?: MensajeGraph[]; "@odata.nextLink"?: string };
    for (const m of datos.value ?? []) {
      r.revisados++;
      hasta = new Date(m.receivedDateTime);
      const asunto = m.subject ?? "";
      const clase = m.singleValueExtendedProperties?.find((p) => p.id.toLowerCase() === CLASE_MENSAJE.toLowerCase())?.value ?? null;
      if (!esInformeNoEntrega({ asunto, clase })) continue;
      r.rebotes++;
      try {
        const contenido = m.body?.content ?? "";
        const analisis = analizarRebote(m.body?.contentType?.toLowerCase() === "html" ? textoPlano(contenido) : contenido, [cliente.remitente]);
        const coincidencia = await filasDelRebote(analisis, asunto);
        const filas = coincidencia.filas.filter((f) => coincidencia.exacta || analisis.destinatarios.includes(f.destinatario));
        if (filas.length === 0) continue;
        const detalle = [analisis.codigo, analisis.diagnostico].filter(Boolean).join(" · ").slice(0, 500) || "Informe de no entrega sin diagnóstico.";
        const nuevos = filas.filter((f) => f.estado !== "REBOTADO");
        if (nuevos.length) {
          await db.correoEnviado.updateMany({ where: { id: { in: nuevos.map((f) => f.id) } }, data: { estado: "REBOTADO", rebote: detalle, html: null, proximoIntento: null } });
          r.marcados += nuevos.length;
        }
        if (analisis.suprimir && nuevos.length) {
          for (const correo of new Set(nuevos.map((f) => f.destinatario))) {
            await db.correoSuprimido.upsert({
              where: { correo },
              create: { correo, motivo: detalle, codigo: analisis.codigo },
              update: { motivo: detalle, codigo: analisis.codigo, rebotes: { increment: 1 }, ultimoEn: new Date() },
            });
            r.suprimidas++;
          }
        }
        if (!coincidencia.exacta) continue;
        const movido = await cliente.graph(`${buzon}/messages/${encodeURIComponent(m.id)}/move`, { method: "POST", body: JSON.stringify({ destinationId: "deleteditems" }) });
        if (movido instanceof Response && movido.ok) r.movidos++;
      } catch (err) {
        console.error("Rebote no procesado:", err);
      }
    }
    ruta = datos["@odata.nextLink"]?.replace("https://graph.microsoft.com/v1.0", "") ?? null;
  }
  await guardarAvance();
  return r;
}

export async function procesarRebotes(): Promise<ResultadoRebotes[]> {
  const cuentas = await db.cuentaCorreo.findMany({ where: { activa: true }, select: { id: true, nombre: true, rebotesHasta: true, createdAt: true } });
  const resultados: ResultadoRebotes[] = [];
  for (const cuenta of cuentas) {
    const r = await procesarRebotesCuenta(cuenta).catch((err): ResultadoRebotes => ({
      cuenta: cuenta.nombre,
      revisados: 0,
      rebotes: 0,
      marcados: 0,
      suprimidas: 0,
      movidos: 0,
      ok: false,
      mensaje: err instanceof Error ? err.message : String(err),
    }));
    const mensaje = r.ok
      ? `${r.revisados} mensaje(s) revisados, ${r.rebotes} informe(s) de no entrega, ${r.marcados} envío(s) marcados, ${r.suprimidas} dirección(es) suprimidas.`
      : (r.mensaje ?? "Error desconocido.");
    await db.cuentaCorreo.update({ where: { id: cuenta.id }, data: { rebotesRevisionAt: new Date(), rebotesRevisionOk: r.ok, rebotesMensaje: mensaje.slice(0, 500) } }).catch(() => {});
    resultados.push(r);
  }
  return resultados;
}
