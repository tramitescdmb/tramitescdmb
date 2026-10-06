"use client";

import { MigaModulo, type RutaMiga } from "@/components/MigaModulo";

const INICIO_GRUPO: Record<string, string> = {
  Panel: "/correspondencia/panel",
  Correspondencia: "/correspondencia",
  "Expedientes y archivo": "/correspondencia/expedientes",
  Firmas: "/correspondencia/buzon",
  Plantillas: "/correspondencia/plantillas",
  Configuración: "/correspondencia/admin",
  Administración: "/correspondencia/bitacora",
  Ayuda: "/correspondencia/ayuda",
};

const RUTAS: RutaMiga[] = [
  { re: /^\/correspondencia\/panel\/correspondencia$/, trail: ["Panel", "Correspondencia"] },
  { re: /^\/correspondencia\/panel\/archivo$/, trail: ["Panel", "Expedientes y archivo"] },
  { re: /^\/correspondencia\/panel\/sistema$/, trail: ["Panel", "Sistema"] },
  { re: /^\/correspondencia\/panel$/, trail: ["Panel", "Mi trabajo pendiente"] },
  { re: /^\/correspondencia\/nueva\/enviada/, trail: ["Correspondencia", "Radicar enviada"] },
  { re: /^\/correspondencia\/nueva\/interna/, trail: ["Correspondencia", "Radicar memorando"] },
  { re: /^\/correspondencia\/nueva/, trail: ["Correspondencia", "Radicar recibida"] },
  { re: /^\/correspondencia\/expedientes\/nuevo/, trail: ["Expedientes y archivo", "Abrir expediente"] },
  { re: /^\/correspondencia\/expedientes\/[^/]+\/ficha/, trail: ["Expedientes y archivo", "Expedientes", "Ficha del expediente"] },
  { re: /^\/correspondencia\/expedientes\/[^/]+/, trail: ["Expedientes y archivo", "Expedientes", "Expediente"] },
  { re: /^\/correspondencia\/expedientes/, trail: ["Expedientes y archivo", "Expedientes"] },
  { re: /^\/correspondencia\/disposicion/, trail: ["Expedientes y archivo", "Disposición final"] },
  { re: /^\/correspondencia\/fondo\/[^/]+/, trail: ["Expedientes y archivo", "Fondo histórico", "Documento"] },
  { re: /^\/correspondencia\/fondo/, trail: ["Expedientes y archivo", "Fondo histórico"] },
  { re: /^\/correspondencia\/plantillas/, trail: ["Plantillas"] },
  { re: /^\/correspondencia\/admin\/vocabulario/, trail: ["Configuración", "Vocabulario controlado"] },
  { re: /^\/correspondencia\/admin\/metadatos/, trail: ["Configuración", "Campos de metadato"] },
  { re: /^\/correspondencia\/admin\/flujos\/[^/]+/, trail: ["Configuración", "Flujos de trabajo", "Editar flujo"] },
  { re: /^\/correspondencia\/admin\/flujos/, trail: ["Configuración", "Flujos de trabajo"] },
  { re: /^\/correspondencia\/admin/, trail: ["Configuración", "Dependencias y TRD"] },
  { re: /^\/correspondencia\/calendario-laboral/, trail: ["Configuración", "Calendario laboral"] },
  { re: /^\/correspondencia\/bitacora/, trail: ["Administración", "Bitácora"] },
  { re: /^\/correspondencia\/matriz-moreq/, trail: ["Administración", "Matriz de cumplimiento MoReq"] },
  { re: /^\/correspondencia\/manual-demostracion/, trail: ["Administración", "Manual de demostración"] },
  { re: /^\/correspondencia\/ayuda/, trail: ["Ayuda"] },
  { re: /^\/correspondencia\/[^/]+\/constancia/, trail: ["Correspondencia", "Constancia de radicación"] },
  { re: /^\/correspondencia\/buzon/, trail: ["Firmas", "Buzón de firmas"] },
  { re: /^\/correspondencia\/mis-firmas/, trail: ["Firmas", "Mis firmas"] },
  { re: /^\/correspondencia\/rechazos/, trail: ["Firmas", "Rechazos al firmar"] },
  { re: /^\/correspondencia\/[^/]+$/, trail: ["Correspondencia", "Detalle del radicado"] },
  { re: /^\/correspondencia$/, trail: ["Correspondencia", "Bandeja"] },
];

export function MigaSgdea() {
  return <MigaModulo inicio={{ label: "SGDEA", href: "/correspondencia/panel" }} inicioGrupo={INICIO_GRUPO} rutas={RUTAS} />;
}
