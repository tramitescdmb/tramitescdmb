import { NextResponse } from "next/server";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAccederContratacion, puedeAccederCorrespondencia, puedeAccederFirmasTramite, puedePlanearVisitas } from "@/lib/permisos";
import { contarPendientesBuzonContratacion, contarPendientesBuzonTramite, contarRechazosPorAtender } from "@/lib/solicitudes-firma";
import { contarNoLeidas } from "@/lib/notificaciones";
import { contarAlertasVisitasPropias } from "@/lib/pendientes-visitas";
import { contarInformesPorRadicarPropios, requisitosPorCargarPropios } from "@/lib/contratacion-panel";
import { pasosFlujoACargo, usuarioFlujo } from "@/lib/flujos";
import { conceptosDevueltosA, conceptosPorRevisar } from "@/lib/revision-concepto";
import { contarMemorandos, contextoMemorandos } from "@/lib/memorandos";
import { contarPendientesBuzonSgdea } from "@/lib/firmas-sgdea";

type Aviso = { clave: string; titulo: string; detalle?: string; href: string; alerta: boolean; cantidad: number; modulo: "TRAMITES" | "SGDEA" | "GECON" };

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  const avisos: Aviso[] = [];

  if (puedeAccederCorrespondencia(permisos)) {
    const [memos, firmas, pasosFlujo] = await Promise.all([
      contextoMemorandos(session.userId, permisos).then(contarMemorandos),
      contarPendientesBuzonSgdea(session.userId),
      usuarioFlujo(session.userId, permisos).then(pasosFlujoACargo).then((l) => l.length),
    ]);
    if (pasosFlujo > 0) {
      avisos.push({ clave: "flujos-sgdea", titulo: `${pasosFlujo} paso(s) de flujo de trabajo a su cargo`, href: "/correspondencia/flujos-a-cargo", alerta: true, cantidad: pasosFlujo, modulo: "SGDEA" });
    }
    if (memos.porResponder > 0) {
      avisos.push({
        clave: "memos-responder",
        titulo: `${memos.porResponder} memorando(s) por responder`,
        detalle: memos.vencidos > 0 ? `${memos.vencidos} con plazo vencido` : "Dentro del plazo",
        href: "/correspondencia/memorandos?vista=por-responder",
        alerta: memos.vencidos > 0,
        cantidad: memos.porResponder, modulo: "SGDEA",
      });
    }
    if (memos.sinLeer > 0) {
      avisos.push({
        clave: "memos-sin-leer",
        titulo: `${memos.sinLeer} memorando(s) sin leer`,
        href: "/correspondencia/memorandos?vista=sin-leer",
        alerta: false,
        cantidad: memos.sinLeer, modulo: "SGDEA",
      });
    }
    if (firmas.total > firmas.listos) {
      const n = firmas.total - firmas.listos;
      avisos.push({ clave: "firmas-sgdea-espera", titulo: `${n} firma(s) del SGDEA en espera de otro firmante`, detalle: "Le llegará el aviso cuando sea su turno", href: "/correspondencia/buzon", alerta: false, cantidad: n, modulo: "SGDEA" });
    }
    if (firmas.listos > 0) {
      avisos.push({
        clave: "firmas-sgdea",
        titulo: `${firmas.listos} documento(s) del SGDEA para firmar`,
        href: "/correspondencia/buzon",
        alerta: true,
        cantidad: firmas.listos, modulo: "SGDEA",
      });
    }
  }

  if (permisos.modulos.has("TRAMITES")) {
    const firmasTramite = puedeAccederFirmasTramite(permisos);
    const [firmas, rechazos, buzon, visitas, porRevisar, devueltos, pasosFlujo] = await Promise.all([
      firmasTramite ? contarPendientesBuzonTramite(session.userId) : null,
      firmasTramite ? contarRechazosPorAtender(session.userId, false, "documentoExpediente") : 0,
      contarNoLeidas(session.userId),
      contarAlertasVisitasPropias(session.userId),
      puedePlanearVisitas(permisos) ? conceptosPorRevisar(permisos).then((l) => l.length) : 0,
      conceptosDevueltosA(session.userId).then((l) => l.length),
      usuarioFlujo(session.userId, permisos, "TRAMITES").then((u) => pasosFlujoACargo(u, "TRAMITES")).then((l) => l.length),
    ]);
    if (pasosFlujo > 0) {
      avisos.push({ clave: "flujos-tramites", titulo: `${pasosFlujo} paso(s) de flujo de trabajo a su cargo`, href: "/tramites-ambientales#pasos-flujo", alerta: true, cantidad: pasosFlujo, modulo: "TRAMITES" });
    }
    if (porRevisar > 0) {
      avisos.push({ clave: "conceptos-revision", titulo: `${porRevisar} concepto(s) técnico(s) por revisar`, href: "/planeador/conceptos", alerta: true, cantidad: porRevisar, modulo: "TRAMITES" });
    }
    if (devueltos > 0) {
      avisos.push({ clave: "conceptos-devueltos", titulo: `${devueltos} concepto(s) devuelto(s) para corrección`, href: "/planeador/conceptos", alerta: true, cantidad: devueltos, modulo: "TRAMITES" });
    }
    if (firmas && firmas.total > firmas.listos) {
      const n = firmas.total - firmas.listos;
      avisos.push({ clave: "firmas-tramites-espera", titulo: `${n} firma(s) de trámites en espera de otro firmante`, detalle: "Le llegará el aviso cuando sea su turno", href: "/firmas/buzon", alerta: false, cantidad: n, modulo: "TRAMITES" });
    }
    if (firmas && firmas.listos > 0) {
      avisos.push({ clave: "firmas-tramites", titulo: `${firmas.listos} documento(s) de trámites para firmar`, href: "/firmas/buzon", alerta: true, cantidad: firmas.listos, modulo: "TRAMITES" });
    }
    if (rechazos > 0) {
      avisos.push({ clave: "rechazos-tramites", titulo: `${rechazos} firma(s) rechazada(s) en trámites`, detalle: "Documentos que usted cargó o envió a firma", href: "/firmas/rechazos", alerta: true, cantidad: rechazos, modulo: "TRAMITES" });
    }
    if (visitas > 0) {
      avisos.push({ clave: "visitas-propias", titulo: `${visitas} visita(s) técnica(s) por realizar o registrar`, href: "/planeador", alerta: true, cantidad: visitas, modulo: "TRAMITES" });
    }
    if (buzon > 0) {
      avisos.push({ clave: "buzon-planeador", titulo: `${buzon} aviso(s) del planeador sin leer`, href: "/planeador/buzon", alerta: false, cantidad: buzon, modulo: "TRAMITES" });
    }
  }

  if (permisos.modulos.has("GECON") && puedeAccederContratacion(permisos)) {
    const [firmas, rechazos, informes, porCargar, pasosFlujo] = await Promise.all([
      contarPendientesBuzonContratacion(session.userId),
      contarRechazosPorAtender(session.userId, false, "documentoContrato"),
      contarInformesPorRadicarPropios(permisos),
      requisitosPorCargarPropios(permisos).then((l) => l.reduce((n, r) => n + r.requisitos.length, 0)),
      usuarioFlujo(session.userId, permisos, "GECON").then((u) => pasosFlujoACargo(u, "GECON")).then((l) => l.length),
    ]);
    if (pasosFlujo > 0) {
      avisos.push({ clave: "flujos-gecon", titulo: `${pasosFlujo} paso(s) de flujo de trabajo a su cargo`, href: "/contratacion/panel#pasos-flujo", alerta: true, cantidad: pasosFlujo, modulo: "GECON" });
    }
    if (porCargar > 0) {
      avisos.push({ clave: "requisitos-gecon", titulo: `${porCargar} requisito(s) por cargar en sus contratos`, detalle: "Etapa actual de los contratos asignados o que supervisa", href: "/contratacion/panel#requisitos", alerta: false, cantidad: porCargar, modulo: "GECON" });
    }
    if (informes > 0) {
      avisos.push({ clave: "informes-gecon", titulo: `${informes} informe(s) de supervisión por radicar`, detalle: "De sus contratos o de los que supervisa", href: "/contratacion/panel#informes", alerta: true, cantidad: informes, modulo: "GECON" });
    }
    if (firmas.total > firmas.listos) {
      const n = firmas.total - firmas.listos;
      avisos.push({ clave: "firmas-gecon-espera", titulo: `${n} firma(s) de GECON en espera de otro firmante`, detalle: "Le llegará el aviso cuando sea su turno", href: "/contratacion/buzon", alerta: false, cantidad: n, modulo: "GECON" });
    }
    if (firmas.listos > 0) {
      avisos.push({ clave: "firmas-gecon", titulo: `${firmas.listos} documento(s) de GECON para firmar`, href: "/contratacion/mis-firmas", alerta: true, cantidad: firmas.listos, modulo: "GECON" });
    }
    if (rechazos > 0) {
      avisos.push({ clave: "rechazos-gecon", titulo: `${rechazos} firma(s) rechazada(s) en GECON`, detalle: "Documentos que usted cargó", href: "/contratacion/rechazos-firma", alerta: true, cantidad: rechazos, modulo: "GECON" });
    }
  }

  return NextResponse.json({ avisos });
}
