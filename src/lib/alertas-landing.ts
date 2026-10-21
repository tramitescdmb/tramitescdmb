import { ETIQUETA_FASE_LIQUIDACION } from "@/lib/liquidacion";
import { contarMemorandos, contextoMemorandos } from "@/lib/memorandos";
import { identificacionContrato } from "@/lib/codigo-proceso";
import {
  obtenerPermisosUsuario,
  puedeAccederCorrespondencia,
  puedeAccederContratacion,
  puedeAccederFirmasTramite,
  puedeGestionarContratistas,
  puedePlanearVisitas,
  type PermisosUsuario,
} from "@/lib/permisos";
import { getPendientes } from "@/lib/pendientes";
import { getPendientesVisitas } from "@/lib/pendientes-visitas";
import { contarPendientesBuzonTramite } from "@/lib/solicitudes-firma";
import { contarPendientesBuzonSgdea } from "@/lib/firmas-sgdea";
import { agruparPorExpediente, obtenerTrabajoPendienteContratacion, type DocumentoPorGestionar, type InformePorRadicar } from "@/lib/contratacion-panel";
import { obtenerPanelMiTrabajo } from "@/lib/correspondencia-panel";
import type { SessionPayload } from "@/lib/auth";
import { textoEsperaA, textoRecordatorio } from "@/components/EsperaTurnoFirma";

export type TipoAlerta =
  | "informacion"
  | "decision"
  | "visita"
  | "documento"
  | "paso"
  | "firma"
  | "esperaFirma"
  | "sinFirmante"
  | "validar"
  | "informe"
  | "liquidacion"
  | "contratista"
  | "correspondencia"
  | "flujo";

export type ItemAlerta = { titulo: string; detalle?: string; link: string; tipo: TipoAlerta; cantidad?: number };

export type SeccionAlertasModulo = {
  modulo: "TRAMITES" | "GECON" | "SGDEA";
  nombre: string;
  /** Total real de pendientes del módulo — puede ser mayor que items.length. */
  total: number;
  items: ItemAlerta[];
  masLink: string;
  masTexto: string;
};

const MAX_ITEMS_POR_SECCION = 100;

/**
 * Agrega, por cada módulo al que el usuario tenga acceso, sus propios pendientes/alertas ya
 * calculados por ese módulo (getPendientes, getPendientesVisitas, obtenerTrabajoPendienteContratacion,
 * obtenerPanelMiTrabajo, los conteos de buzón de firmas) en una forma común {titulo, link}. No
 * recalcula nada: cada módulo sigue siendo dueño de su propia lógica de "qué me corresponde" — esto
 * solo la junta para la landing. Un usuario sin acceso a un módulo simplemente no genera su sección.
 */
export async function obtenerSeccionesAlertas(session: SessionPayload): Promise<SeccionAlertasModulo[]> {
  const permisos = await obtenerPermisosUsuario(session.userId);

  const mostrarTramites = permisos.modulos.has("TRAMITES");
  const mostrarCorrespondencia = puedeAccederCorrespondencia(permisos);
  const mostrarContratacion = puedeAccederContratacion(permisos);

  const [tramites, contratacion, correspondencia] = await Promise.all([
    mostrarTramites ? seccionTramites(session, permisos) : Promise.resolve(null),
    mostrarContratacion ? seccionContratacion(session, permisos) : Promise.resolve(null),
    mostrarCorrespondencia ? seccionCorrespondencia(session, permisos) : Promise.resolve(null),
  ]);

  return [contratacion, tramites, correspondencia].filter((s): s is SeccionAlertasModulo => s !== null);
}

async function seccionTramites(session: SessionPayload, permisos: PermisosUsuario): Promise<SeccionAlertasModulo | null> {
  const [pendientes, visitas, buzon] = await Promise.all([
    getPendientes({ userId: session.userId, rol: session.rol, cargos: session.cargos }),
    getPendientesVisitas({
      userId: session.userId,
      planificador: puedePlanearVisitas(permisos),
      tramitesPermitidos: permisos.esAdmin ? null : Array.from(permisos.tramites.keys()),
    }),
    puedeAccederFirmasTramite(permisos) ? contarPendientesBuzonTramite(session.userId) : Promise.resolve(null),
  ]);

  const items: ItemAlerta[] = [];
  let total = 0;

  for (const d of pendientes?.informacionAdicional ?? []) {
    total++;
    items.push({ titulo: `Información adicional: ${d.numero}`, detalle: `${d.tramiteNombre} · ${d.pasoTitulo}`, link: `/expedientes/${d.expedienteId}`, tipo: "informacion" });
  }
  for (const d of pendientes?.decisiones ?? []) {
    total++;
    items.push({ titulo: `Decisión pendiente: ${d.numero}`, detalle: `${d.tramiteNombre} · ${d.pasoTitulo}`, link: `/expedientes/${d.expedienteId}`, tipo: "decision" });
  }
  for (const v of [...(visitas?.equipoVencidas ?? []), ...(visitas?.porRegistrar ?? []), ...(visitas?.proximas ?? [])]) {
    total++;
    items.push({
      titulo: v.texto,
      detalle: `${v.tramite} · ${v.numero}`,
      link: v.visitaId ? `/expedientes/${v.expedienteId}/visitas/${v.visitaId}` : `/expedientes/${v.expedienteId}`,
      tipo: "visita",
    });
  }
  for (const d of pendientes?.documentos ?? []) {
    total++;
    items.push({ titulo: `Falta documento: ${d.detalle ?? "ver expediente"}`, detalle: `${d.tramiteNombre} · ${d.numero}`, link: `/expedientes/${d.expedienteId}`, tipo: "documento" });
  }
  for (const d of pendientes?.gestionPaso ?? []) {
    total++;
    items.push({ titulo: `Gestionar paso: ${d.numero}`, detalle: `${d.tramiteNombre} · ${d.pasoTitulo}`, link: `/expedientes/${d.expedienteId}`, tipo: "paso" });
  }
  if (buzon && buzon.listos > 0) {
    total += buzon.listos;
    items.push({ titulo: `${buzon.listos} firma(s) lista(s) para firmar`, link: "/firmas/buzon", tipo: "firma", cantidad: buzon.listos });
  }

  return {
    modulo: "TRAMITES",
    nombre: "Trámites ambientales 2.0",
    total,
    items: items.slice(0, MAX_ITEMS_POR_SECCION),
    masLink: "/tramites-ambientales",
    masTexto: "Ver panel de Trámites ambientales",
  };
}

async function seccionContratacion(session: SessionPayload, permisos: PermisosUsuario): Promise<SeccionAlertasModulo | null> {
  const trabajo = await obtenerTrabajoPendienteContratacion(session.userId, permisos, puedeGestionarContratistas(permisos));

  const items: ItemAlerta[] = [];
  let total = 0;

  for (const g of agruparInformes(trabajo.informes.lista)) {
    const masAtrasado = g[0]!;
    total += g.length;
    items.push({
      titulo: `${identificacionContrato(masAtrasado)} · ${g.length === 1 ? `informe de ${masAtrasado.mes}` : `${g.length} informes`} por radicar`,
      detalle: `${masAtrasado.contratista ?? "Sin contratista"} · ${g.map((i) => `${i.mes.slice(0, 3)}${i.diasDeRetraso > 0 ? ` ${i.diasDeRetraso} d` : ""}`).join(", ")}`,
      link: `/contratacion/expedientes/${masAtrasado.expedienteId}?periodo=${masAtrasado.periodoClave}#periodo-${masAtrasado.periodoClave}`,
      tipo: "informe",
      cantidad: g.length,
    });
  }
  total += trabajo.sinFirmante.total + trabajo.porValidar.total;
  items.push(...itemsDocumentosPorContrato(trabajo.sinFirmante.lista, "sinFirmante", "sin firmante asignado"));
  items.push(...itemsDocumentosPorContrato(trabajo.porValidar.lista, "validar", "por validar"));
  for (const f of trabajo.firmas.lista.filter((x) => x.puedeActuar)) {
    total++;
    items.unshift({
      titulo: `${f.documentoContrato ? identificacionContrato(f.documentoContrato.expediente) : "Contrato"} · ${f.rol === "VISTO_BUENO" ? "visto bueno" : "firmar"}: ${f.documentoContrato?.nombre ?? "documento"}`,
      detalle: [
        f.documentoContrato?.expediente.contratista?.nombreORazonSocial ?? "Sin contratista",
        `asignado por ${f.asignadoPor.nombre}`,
        textoRecordatorio(f.recordadoPor, f.recordadoEn),
      ]
        .filter(Boolean)
        .join(" · "),
      link: `/contratacion/firmar/${f.id}`,
      tipo: "firma",
    });
  }
  total += trabajo.firmas.total - trabajo.firmas.listos;
  for (const f of trabajo.firmas.lista.filter((x) => !x.puedeActuar)) {
    items.push({
      titulo: `${f.documentoContrato ? identificacionContrato(f.documentoContrato.expediente) : "Contrato"} · ${f.rol === "VISTO_BUENO" ? "visto bueno" : "firmar"}: ${f.documentoContrato?.nombre ?? "documento"}`,
      detalle: textoEsperaA(f.esperaA),
      link: "/contratacion/buzon",
      tipo: "esperaFirma",
    });
  }
  for (const l of trabajo.liquidaciones) {
    total++;
    items.push({
      titulo: `${identificacionContrato(l.expediente)} · ${ETIQUETA_FASE_LIQUIDACION[l.estado.fase].toLowerCase()}`,
      detalle:
        l.estado.fase === "sin-competencia"
          ? "Venció el término para liquidar"
          : `Hasta el ${l.estado.limite!.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })} · ${l.estado.dias} día(s)`,
      link: `/contratacion/expedientes/${l.expediente.id}`,
      tipo: "liquidacion",
    });
  }
  if (trabajo.sinContratista > 0) {
    total += trabajo.sinContratista;
    items.push({ titulo: `${trabajo.sinContratista} expediente(s) sin contratista asignado`, link: "/contratacion/expedientes?contratista=sin", tipo: "contratista" });
  }

  return {
    modulo: "GECON",
    nombre: "GECON — Contratación",
    total,
    items: items.slice(0, MAX_ITEMS_POR_SECCION),
    masLink: "/contratacion/panel",
    masTexto: "Ver pendientes en GECON",
  };
}

function agruparInformes(informes: InformePorRadicar[]): InformePorRadicar[][] {
  const grupos = new Map<string, InformePorRadicar[]>();
  for (const i of informes) grupos.set(i.expedienteId, [...(grupos.get(i.expedienteId) ?? []), i]);
  return [...grupos.values()]
    .map((g) => [...g].sort((a, b) => b.diasDeRetraso - a.diasDeRetraso))
    .sort((a, b) => b[0]!.diasDeRetraso - a[0]!.diasDeRetraso);
}

function itemsDocumentosPorContrato(docs: DocumentoPorGestionar[], tipo: TipoAlerta, estado: string): ItemAlerta[] {
  return agruparPorExpediente(docs).map((g) => ({
    titulo: `${identificacionContrato(g.expediente)} · ${g.documentos.length === 1 ? "1 documento" : `${g.documentos.length} documentos`} ${estado}`,
    detalle: `${g.expediente.contratista ?? "Sin contratista"} · ${g.documentos.map((d) => d.nombre).join(", ")}`,
    link: `/contratacion/expedientes/${g.expediente.id}#documento-${g.documentos[0]!.id}`,
    tipo,
    cantidad: g.documentos.length,
  }));
}

async function seccionCorrespondencia(session: SessionPayload, permisos: PermisosUsuario): Promise<SeccionAlertasModulo | null> {
  const [panel, buzon, memorandos] = await Promise.all([
    obtenerPanelMiTrabajo(session.userId, permisos),
    contarPendientesBuzonSgdea(session.userId),
    contextoMemorandos(session.userId, permisos).then(contarMemorandos),
  ]);

  const items: ItemAlerta[] = [];
  let total = 0;

  if (memorandos.porResponder > 0) {
    total += memorandos.porResponder;
    items.push({
      titulo: `${memorandos.porResponder} memorando(s) por responder${memorandos.vencidos > 0 ? ` — ${memorandos.vencidos} con plazo vencido` : ""}`,
      link: "/correspondencia/memorandos?vista=por-responder",
      tipo: "correspondencia",
      cantidad: memorandos.porResponder,
    });
  }
  if (memorandos.sinLeer > 0) {
    total += memorandos.sinLeer;
    items.push({ titulo: `${memorandos.sinLeer} memorando(s) sin leer`, link: "/correspondencia/memorandos?vista=sin-leer", tipo: "correspondencia", cantidad: memorandos.sinLeer });
  }

  for (const c of panel.mis.lista) {
    if (c.tipo === "INTERNA") continue;
    const vencida = Boolean(c.fechaVencimiento && c.fechaVencimiento < new Date());
    if (!c.sinResponder && !vencida) continue;
    total++;
    items.push({
      titulo: `${c.radicado} ${vencida ? "— vencida" : "— por responder"}`,
      detalle: c.asunto.slice(0, 80),
      link: `/correspondencia/${c.id}`,
      tipo: "correspondencia",
    });
  }
  if (buzon.listos > 0) {
    total += buzon.listos;
    items.push({ titulo: `${buzon.listos} firma(s) lista(s) para firmar`, link: "/correspondencia/buzon", tipo: "firma", cantidad: buzon.listos });
  }
  const otros = panel.pendientesProceso + panel.devueltasEsperandoReparto + panel.oficiosSinDespachar + panel.flujosPasoVencido;
  if (otros > 0 && (panel.puedeDistribuir || panel.puedeDespachar)) {
    total += otros;
    items.push({ titulo: `${otros} pendiente(s) de reparto, despacho o flujo`, link: "/correspondencia/panel", tipo: "flujo" });
  }

  return {
    modulo: "SGDEA",
    nombre: "SGDEA CDMB",
    total,
    items: items.slice(0, MAX_ITEMS_POR_SECCION),
    masLink: "/correspondencia/panel",
    masTexto: "Ver pendientes en SGDEA",
  };
}
