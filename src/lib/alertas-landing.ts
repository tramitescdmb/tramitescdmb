import { getConfiguracionSitio } from "@/lib/config-sitio";
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
import { obtenerTrabajoPendienteContratacion } from "@/lib/contratacion-panel";
import { obtenerPanelMiTrabajo } from "@/lib/correspondencia-panel";
import type { SessionPayload } from "@/lib/auth";

export type ItemAlerta = { titulo: string; detalle?: string; link: string };

export type SeccionAlertasModulo = {
  modulo: "TRAMITES" | "GECON" | "SGDEA";
  nombre: string;
  /** Total real de pendientes del módulo — puede ser mayor que items.length. */
  total: number;
  items: ItemAlerta[];
  masLink: string;
  masTexto: string;
};

const MAX_ITEMS_POR_SECCION = 6;

/**
 * Agrega, por cada módulo al que el usuario tenga acceso, sus propios pendientes/alertas ya
 * calculados por ese módulo (getPendientes, getPendientesVisitas, obtenerTrabajoPendienteContratacion,
 * obtenerPanelMiTrabajo, los conteos de buzón de firmas) en una forma común {titulo, link}. No
 * recalcula nada: cada módulo sigue siendo dueño de su propia lógica de "qué me corresponde" — esto
 * solo la junta para la landing. Un usuario sin acceso a un módulo simplemente no genera su sección.
 */
export async function obtenerSeccionesAlertas(session: SessionPayload): Promise<SeccionAlertasModulo[]> {
  const [permisos, config] = await Promise.all([obtenerPermisosUsuario(session.userId), getConfiguracionSitio()]);

  // Mismo criterio que NavBar/SidebarNav usan para decidir si el módulo aparece en el menú lateral
  // — si ese criterio cambia allá, debe cambiar aquí también para que la landing y el menú coincidan.
  const mostrarTramites = permisos.esAdmin || config.tramitesVisibleFuncionarios;
  const mostrarCorrespondencia = puedeAccederCorrespondencia(permisos);
  const mostrarContratacion = puedeAccederContratacion(permisos);

  const [tramites, contratacion, correspondencia] = await Promise.all([
    mostrarTramites ? seccionTramites(session, permisos) : Promise.resolve(null),
    mostrarContratacion ? seccionContratacion(session, permisos) : Promise.resolve(null),
    mostrarCorrespondencia ? seccionCorrespondencia(session, permisos) : Promise.resolve(null),
  ]);

  return [tramites, contratacion, correspondencia].filter((s): s is SeccionAlertasModulo => s !== null);
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
    items.push({ titulo: `Información adicional: ${d.numero}`, detalle: `${d.tramiteNombre} · ${d.pasoTitulo}`, link: `/expedientes/${d.expedienteId}` });
  }
  for (const d of pendientes?.decisiones ?? []) {
    total++;
    items.push({ titulo: `Decisión pendiente: ${d.numero}`, detalle: `${d.tramiteNombre} · ${d.pasoTitulo}`, link: `/expedientes/${d.expedienteId}` });
  }
  for (const v of [...(visitas?.equipoVencidas ?? []), ...(visitas?.porRegistrar ?? []), ...(visitas?.proximas ?? [])]) {
    total++;
    items.push({ titulo: v.texto, detalle: `${v.tramite} · ${v.numero}`, link: v.visitaId ? `/expedientes/${v.expedienteId}/visitas/${v.visitaId}` : `/expedientes/${v.expedienteId}` });
  }
  for (const d of pendientes?.documentos ?? []) {
    total++;
    items.push({ titulo: `Falta documento: ${d.detalle ?? "ver expediente"}`, detalle: `${d.tramiteNombre} · ${d.numero}`, link: `/expedientes/${d.expedienteId}` });
  }
  for (const d of pendientes?.gestionPaso ?? []) {
    total++;
    items.push({ titulo: `Gestionar paso: ${d.numero}`, detalle: `${d.tramiteNombre} · ${d.pasoTitulo}`, link: `/expedientes/${d.expedienteId}` });
  }
  if (buzon && buzon.listos > 0) {
    total += buzon.listos;
    items.push({ titulo: `${buzon.listos} firma(s) lista(s) para firmar`, link: "/firmas/buzon" });
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

  for (const i of trabajo.informes.lista) {
    total++;
    items.push({
      titulo: `Informe N.° ${i.numeroInforme} por radicar`,
      detalle: `${i.objeto.slice(0, 70)} · ${i.rango}${i.diasDeRetraso > 0 ? ` · ${i.diasDeRetraso} día(s) de retraso` : ""}`,
      link: `/contratacion/expedientes/${i.expedienteId}`,
    });
  }
  if (trabajo.firmas.listos > 0) {
    total += trabajo.firmas.listos;
    items.push({ titulo: `${trabajo.firmas.listos} firma(s) lista(s) para firmar`, link: "/contratacion/buzon" });
  }
  if (trabajo.sinContratista > 0) {
    total += trabajo.sinContratista;
    items.push({ titulo: `${trabajo.sinContratista} expediente(s) sin contratista asignado`, link: "/contratacion/expedientes" });
  }

  return {
    modulo: "GECON",
    nombre: "GECON — Contratación",
    total,
    items: items.slice(0, MAX_ITEMS_POR_SECCION),
    masLink: "/contratacion/panel",
    masTexto: "Ver mi trabajo pendiente en GECON",
  };
}

async function seccionCorrespondencia(session: SessionPayload, permisos: PermisosUsuario): Promise<SeccionAlertasModulo | null> {
  const [panel, buzon] = await Promise.all([
    obtenerPanelMiTrabajo(session.userId, permisos),
    contarPendientesBuzonSgdea(session.userId),
  ]);

  const items: ItemAlerta[] = [];
  let total = 0;

  for (const c of panel.mis.lista) {
    const vencida = Boolean(c.fechaVencimiento && c.fechaVencimiento < new Date());
    if (!c.sinResponder && !vencida) continue;
    total++;
    items.push({
      titulo: `${c.radicado} ${vencida ? "— vencida" : "— por responder"}`,
      detalle: c.asunto.slice(0, 80),
      link: `/correspondencia/${c.id}`,
    });
  }
  if (buzon.listos > 0) {
    total += buzon.listos;
    items.push({ titulo: `${buzon.listos} firma(s) lista(s) para firmar`, link: "/correspondencia/buzon" });
  }
  const otros = panel.pendientesProceso + panel.devueltasEsperandoReparto + panel.oficiosSinDespachar + panel.flujosPasoVencido;
  if (otros > 0 && (panel.puedeDistribuir || panel.puedeDespachar)) {
    total += otros;
    items.push({ titulo: `${otros} pendiente(s) de reparto, despacho o flujo`, link: "/correspondencia/panel" });
  }

  return {
    modulo: "SGDEA",
    nombre: "SGDEA CDMB",
    total,
    items: items.slice(0, MAX_ITEMS_POR_SECCION),
    masLink: "/correspondencia/panel",
    masTexto: "Ver mi trabajo pendiente en SGDEA",
  };
}
