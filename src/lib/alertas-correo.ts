import type { RolFirmante } from "@prisma/client";
import { db } from "@/lib/db";
import { getCalendarioLaboral } from "@/lib/calendario-laboral";
import { diasHabilesEntre } from "@/lib/dias-habiles";
import { ESTADOS_ACTIVOS } from "@/lib/correspondencia-panel";
import { estadoTerminoPaso, objetivoDeInstancia, SELECT_OBJETIVO_FLUJO } from "@/lib/flujos";
import { CODIGOS_FORMATO_POR_PERIODOS, calcularPeriodosInforme, etiquetaRangoPeriodo, periodosPorRadicar } from "@/lib/periodos-informe";
import { hoyColombia } from "@/lib/contratacion-panel";
import { obtenerPermisosUsuario, puedeDistribuir } from "@/lib/permisos";
import { BUZON_POR_MODULO, moduloDeObjetivo } from "@/lib/solicitudes-firma";
import { eventosActivos, correosDeUsuarios, type EventoAviso, escaparHtml, parametros, urlBasePlataforma, yaEnviado } from "@/lib/avisos-correo";
import { enviarCorreo, plantillaCorreo } from "@/lib/correo-microsoft";

type Alerta = { evento: EventoAviso; clave: string; grupo: string; texto: string; ruta: string; urgente: boolean };

export type ResultadoAlertas = { ok: boolean; alertas: number; usuarios: number; correos: number; fallidos: number; motivo?: string; simulacion?: { correo: string; alertas: string[] }[] };

const DIA = 86_400_000;
const PQRSD_DIAS_AVISO = 3;
const MEMORANDO_DIAS_AVISO = 1;
const FLUJO_DIAS_AVISO = 1;
const FIRMA_DIAS_SIN_ATENDER = [3, 10];
const INFORME_DIAS_RETRASO = [1, 10];

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function fecha(d: Date) {
  return d.toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short" });
}

function escalon(dias: number, escalones: number[]): number | null {
  return [...escalones].reverse().find((e) => dias >= e) ?? null;
}

class Bandeja {
  porUsuario = new Map<string, Alerta[]>();
  agregar(usuarioIds: (string | null | undefined)[], alerta: Alerta) {
    for (const id of new Set(usuarioIds.filter((u): u is string => Boolean(u)))) {
      const lista = this.porUsuario.get(id) ?? [];
      if (!lista.some((a) => a.clave === alerta.clave)) lista.push(alerta);
      this.porUsuario.set(id, lista);
    }
  }
}

let repartidoresEnCache: string[] | null = null;

async function repartidores(): Promise<string[]> {
  if (repartidoresEnCache) return repartidoresEnCache;
  const usuarios = await db.usuario.findMany({ where: { activo: true }, select: { id: true, rol: true } });
  const conReparto: { id: string; admin: boolean }[] = [];
  for (const u of usuarios) {
    const permisos = await obtenerPermisosUsuario(u.id).catch(() => null);
    if (permisos && puedeDistribuir(permisos)) conReparto.push({ id: u.id, admin: u.rol === "ADMIN" });
  }
  const sinAdmin = conReparto.filter((u) => !u.admin);
  repartidoresEnCache = (sinAdmin.length ? sinAdmin : conReparto).map((u) => u.id);
  return repartidoresEnCache;
}

async function alertasPqrsd(bandeja: Bandeja, ahora: Date) {
  const cal = await getCalendarioLaboral();
  const filas = await db.comunicacion.findMany({
    where: { tipo: "RECIBIDA", tipoPqrsd: { not: null }, estado: { in: ESTADOS_ACTIVOS }, fechaVencimiento: { not: null, lte: new Date(ahora.getTime() + 10 * DIA) } },
    take: 1000,
    select: { id: true, radicado: true, asunto: true, fechaVencimiento: true, distribuciones: { where: { activa: true, usuarioId: { not: null } }, select: { usuarioId: true } } },
  });
  for (const c of filas) {
    const vence = c.fechaVencimiento!;
    const vencida = vence < ahora;
    if (!vencida && diasHabilesEntre(ahora, vence, cal) > PQRSD_DIAS_AVISO) continue;
    const responsables = c.distribuciones.map((d) => d.usuarioId);
    bandeja.agregar(responsables.length ? responsables : await repartidores(), {
      evento: "PQRSD_POR_VENCER",
      clave: `pqrsd-${vencida ? "vencida" : "por-vencer"}:${c.id}:${iso(vence)}`,
      grupo: "PQRSD",
      texto: `${c.radicado} — ${vencida ? "venció" : "vence"} el ${fecha(vence)}${responsables.length ? "" : " (sin funcionario asignado)"} · ${c.asunto.slice(0, 90)}`,
      ruta: `/correspondencia/${c.id}`,
      urgente: vencida,
    });
  }
}

async function alertasMemorandos(bandeja: Bandeja, ahora: Date) {
  const cal = await getCalendarioLaboral();
  const filas = await db.comunicacion.findMany({
    where: { tipo: "INTERNA", respuestaTexto: null, estado: { in: ESTADOS_ACTIVOS }, fechaVencimiento: { not: null, lte: new Date(ahora.getTime() + 5 * DIA) } },
    take: 1000,
    select: { id: true, radicado: true, asunto: true, fechaVencimiento: true, distribuciones: { where: { activa: true, usuarioId: { not: null } }, select: { usuarioId: true } } },
  });
  for (const c of filas) {
    const vence = c.fechaVencimiento!;
    const vencido = vence < ahora;
    if (!vencido && diasHabilesEntre(ahora, vence, cal) > MEMORANDO_DIAS_AVISO) continue;
    bandeja.agregar(
      c.distribuciones.map((d) => d.usuarioId),
      {
        evento: "MEMORANDO_POR_VENCER",
        clave: `memorando-${vencido ? "vencido" : "por-vencer"}:${c.id}:${iso(vence)}`,
        grupo: "Memorandos por responder",
        texto: `${c.radicado} — plazo ${vencido ? "vencido" : "hasta"} el ${fecha(vence)} · ${c.asunto.slice(0, 90)}`,
        ruta: `/correspondencia/${c.id}`,
        urgente: vencido,
      }
    );
  }
}

async function alertasFlujos(bandeja: Bandeja, ahora: Date) {
  const cal = await getCalendarioLaboral();
  const instancias = await db.instanciaFlujo.findMany({
    where: { estado: "EN_CURSO", pasoActualDesde: { not: null }, pasoActual: { slaDiasHabiles: { not: null }, tipo: { not: "FIN" } } },
    take: 2000,
    select: {
      id: true,
      iniciadoPorId: true,
      asignadoAId: true,
      pasoActualId: true,
      pasoActualDesde: true,
      flujo: { select: { nombre: true } },
      pasoActual: { select: { nombre: true, slaDiasHabiles: true, asignacion: true } },
      ejecuciones: { orderBy: { completadoEn: "desc" }, take: 1, select: { responsableId: true } },
      ...SELECT_OBJETIVO_FLUJO,
    },
  });
  for (const i of instancias) {
    const paso = i.pasoActual;
    if (!paso) continue;
    const termino = estadoTerminoPaso(i.pasoActualDesde, paso.slaDiasHabiles, cal, ahora);
    if (!termino || (!termino.vencido && termino.diasHabiles > FLUJO_DIAS_AVISO)) continue;
    const objetivo = objetivoDeInstancia(i);
    if (!objetivo.abierto) continue;
    const responsables =
      paso.asignacion === "MANUAL"
        ? [i.asignadoAId]
        : paso.asignacion === "RADICADOR"
          ? [objetivo.ctx.radicadoPorId]
          : paso.asignacion === "RESPONSABLE_PASO_ANTERIOR"
            ? [i.ejecuciones[0]?.responsableId ?? i.iniciadoPorId]
            : paso.asignacion === "PERSONAL_ASIGNADO"
              ? (objetivo.ctx.asignadosIds ?? [])
              : paso.asignacion === "SUPERVISOR"
                ? (objetivo.ctx.supervisoresIds ?? [])
                : [];
    bandeja.agregar(responsables, {
      evento: "FLUJO_POR_VENCER",
      clave: `flujo-${termino.vencido ? "vencido" : "por-vencer"}:${i.id}:${i.pasoActualId}:${iso(i.pasoActualDesde!)}`,
      grupo: "Pasos de flujo",
      texto: `${objetivo.etiqueta} — «${paso.nombre}» (${i.flujo.nombre}) ${termino.vencido ? "venció" : "vence"} el ${fecha(termino.limite)}`,
      ruta: objetivo.href,
      urgente: termino.vencido,
    });
  }
}

async function alertasInformes(bandeja: Bandeja) {
  const hoy = hoyColombia();
  const contratos = await db.expedienteContractual.findMany({
    where: { eliminado: false, cerrado: false, etapaActual: "CONTRACTUAL", fechaInicio: { not: null }, fechaFinEstimada: { not: null } },
    take: 2000,
    select: {
      id: true,
      numero: true,
      numeroContrato: true,
      fechaInicio: true,
      fechaFinEstimada: true,
      contratista: { select: { usuarioId: true, nombreORazonSocial: true } },
      supervisores: { select: { usuarioId: true } },
      documentos: { where: { periodoMes: { not: null }, requisito: { codigoFormato: { in: CODIGOS_FORMATO_POR_PERIODOS } } }, select: { periodoMes: true } },
    },
  });
  for (const e of contratos) {
    const claves = new Set(e.documentos.map((d) => d.periodoMes!));
    for (const p of periodosPorRadicar(calcularPeriodosInforme(e.fechaInicio, e.fechaFinEstimada), claves, hoy)) {
      const nivel = escalon(p.diasDeRetraso, INFORME_DIAS_RETRASO);
      if (nivel === null) continue;
      bandeja.agregar([e.contratista?.usuarioId, ...e.supervisores.map((s) => s.usuarioId)], {
        evento: "INFORME_ATRASADO",
        clave: `informe-atrasado:${e.id}:${p.periodo.clave}:${nivel}`,
        grupo: "Informes de contratos sin radicar",
        texto: `${e.numeroContrato ? `Contrato ${e.numeroContrato}` : e.numero} — informe ${p.numero} (${etiquetaRangoPeriodo(p.periodo)}) con ${p.diasDeRetraso} día(s) de retraso${e.contratista ? ` · ${e.contratista.nombreORazonSocial}` : ""}`,
        ruta: `/contratacion/expedientes/${e.id}?periodo=${p.periodo.clave}#periodo-${p.periodo.clave}`,
        urgente: nivel >= 10,
      });
    }
  }
}

function claveObjetivoFirma(s: { comunicacionId: string | null; documentoContratoId: string | null; documentoExpedienteId: string | null; documentoArchivoId: string | null }) {
  return s.comunicacionId ?? s.documentoContratoId ?? s.documentoExpedienteId ?? s.documentoArchivoId ?? "";
}

async function alertasFirmas(bandeja: Bandeja, ahora: Date) {
  const pendientes = await db.solicitudFirma.findMany({
    where: { estado: "PENDIENTE", rol: { not: "LECTURA" } },
    take: 3000,
    select: {
      id: true,
      rol: true,
      orden: true,
      asignadoEn: true,
      usuarioAsignadoId: true,
      comunicacionId: true,
      documentoContratoId: true,
      documentoExpedienteId: true,
      documentoArchivoId: true,
      comunicacion: { select: { radicado: true } },
      documentoContrato: { select: { nombre: true, expediente: { select: { numero: true } } } },
      documentoExpediente: { select: { nombre: true, expediente: { select: { numero: true } } } },
      documentoArchivo: { select: { nombre: true, expediente: { select: { numero: true } } } },
    },
  });
  const bloqueantes = new Map<string, number[]>();
  for (const s of pendientes) {
    if (s.rol !== ("FIRMA" satisfies RolFirmante)) continue;
    const k = claveObjetivoFirma(s);
    bloqueantes.set(k, [...(bloqueantes.get(k) ?? []), s.orden]);
  }
  for (const s of pendientes) {
    const dias = Math.floor((ahora.getTime() - s.asignadoEn.getTime()) / DIA);
    const nivel = escalon(dias, FIRMA_DIAS_SIN_ATENDER);
    if (nivel === null) continue;
    if ((bloqueantes.get(claveObjetivoFirma(s)) ?? []).some((o) => o < s.orden)) continue;
    const tipo = s.comunicacionId ? "comunicacion" : s.documentoContratoId ? "documentoContrato" : s.documentoArchivoId ? "documentoArchivo" : "documentoExpediente";
    const doc = s.documentoContrato ?? s.documentoExpediente ?? s.documentoArchivo;
    const nombre = s.comunicacion ? s.comunicacion.radicado : doc ? `${doc.nombre} (${doc.expediente.numero})` : "Documento";
    bandeja.agregar([s.usuarioAsignadoId], {
      evento: "FIRMA_SIN_ATENDER",
      clave: `firma-sin-atender:${s.id}:${nivel}`,
      grupo: "Firmas sin atender",
      texto: `${s.rol === "FIRMA" ? "Firmar" : "Visto bueno"}: ${nombre} — asignada hace ${dias} día(s)`,
      ruta: BUZON_POR_MODULO[moduloDeObjetivo(tipo)],
      urgente: nivel >= 10,
    });
  }
}

function cuerpoAlertas(alertas: Alerta[], base: string | null): string {
  const grupos = new Map<string, Alerta[]>();
  for (const a of alertas) grupos.set(a.grupo, [...(grupos.get(a.grupo) ?? []), a]);
  return [...grupos.entries()]
    .map(
      ([grupo, lista]) =>
        `<p style="margin:16px 0 6px;font-weight:600">${escaparHtml(grupo)}</p><ul style="margin:0;padding-left:18px">${lista
          .map((a) => {
            const texto = escaparHtml(a.texto);
            const contenido = base ? `<a href="${base}${a.ruta}" style="color:#038F67">${texto}</a>` : texto;
            return `<li style="margin:0 0 6px${a.urgente ? ";color:#b91c1c" : ""}">${contenido}</li>`;
          })
          .join("")}</ul>`
    )
    .join("");
}

export async function procesarAlertasCorreo(opciones: { simular?: boolean } = {}): Promise<ResultadoAlertas> {
  repartidoresEnCache = null;
  const activos = opciones.simular ? new Set<EventoAviso>(["PQRSD_POR_VENCER", "MEMORANDO_POR_VENCER", "FLUJO_POR_VENCER", "INFORME_ATRASADO", "FIRMA_SIN_ATENDER"]) : await eventosActivos();
  const fuentes: [EventoAviso, (b: Bandeja, ahora: Date) => Promise<void>][] = [
    ["PQRSD_POR_VENCER", alertasPqrsd],
    ["MEMORANDO_POR_VENCER", alertasMemorandos],
    ["FLUJO_POR_VENCER", alertasFlujos],
    ["INFORME_ATRASADO", alertasInformes],
    ["FIRMA_SIN_ATENDER", alertasFirmas],
  ];
  const aplican = fuentes.filter(([evento]) => activos.has(evento));
  if (aplican.length === 0) return { ok: true, alertas: 0, usuarios: 0, correos: 0, fallidos: 0, motivo: "Correo sin configurar o alertas desactivadas." };
  const ahora = new Date();
  const bandeja = new Bandeja();
  for (const [, fuente] of aplican) await fuente(bandeja, ahora);

  const base = urlBasePlataforma((await parametros()).urlPlataforma);
  const r: ResultadoAlertas = { ok: true, alertas: 0, usuarios: 0, correos: 0, fallidos: 0 };
  for (const [usuarioId, alertas] of bandeja.porUsuario) {
    const [correo] = await correosDeUsuarios([usuarioId]);
    if (!correo) continue;
    const nuevas: Alerta[] = [];
    for (const a of alertas) if (!(await yaEnviado(a.clave, correo))) nuevas.push(a);
    if (nuevas.length === 0) continue;
    nuevas.sort((a, b) => Number(b.urgente) - Number(a.urgente));
    r.usuarios++;
    r.alertas += nuevas.length;
    if (opciones.simular) {
      (r.simulacion ??= []).push({ correo, alertas: nuevas.map((a) => `[${a.evento}] ${a.texto}`) });
      continue;
    }
    const urgentes = nuevas.filter((a) => a.urgente).length;
    const asunto = `${nuevas.length} alerta(s) de vencimiento${urgentes ? ` — ${urgentes} vencida(s)` : ""} · Plataforma CDMB`;
    const envio = await enviarCorreo({
      para: [correo],
      asunto,
      html: plantillaCorreo("Alertas de vencimiento", cuerpoAlertas(nuevas, base), base ? { texto: "Ir a la plataforma", url: base } : undefined),
    });
    if (envio.ok) r.correos++;
    else r.fallidos++;
    for (const a of nuevas) {
      await db.correoEnviado.upsert({
        where: { clave_destinatario: { clave: a.clave, destinatario: correo } },
        create: { clave: a.clave, destinatario: correo, categoria: a.evento, asunto: asunto.slice(0, 300), ok: envio.ok, error: envio.ok ? null : envio.mensaje.slice(0, 1000) },
        update: { ok: envio.ok, error: envio.ok ? null : envio.mensaje.slice(0, 1000) },
      });
    }
  }
  r.ok = r.fallidos === 0;
  return r;
}
