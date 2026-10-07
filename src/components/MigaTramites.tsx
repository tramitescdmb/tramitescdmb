"use client";

import { MigaModulo, type RutaMiga } from "@/components/MigaModulo";

const INICIO_GRUPO: Record<string, string> = {
  Panel: "/",
  "Catálogo de trámites": "/tramites",
  Expedientes: "/expedientes",
  "Visor de trámites": "/visor-tramites",
  Planeador: "/planeador",
  Solicitantes: "/solicitantes",
  Firmas: "/firmas/buzon",
};

const RUTAS: RutaMiga[] = [
  { re: /^\/$/, trail: ["Panel"] },
  { re: /^\/tramites\/[^/]+\/nuevo/, trail: ["Catálogo de trámites", "Trámite", "Radicar solicitud"] },
  { re: /^\/tramites\/[^/]+/, trail: ["Catálogo de trámites", "Trámite"] },
  { re: /^\/tramites$/, trail: ["Catálogo de trámites"] },
  { re: /^\/expedientes\/disposicion/, trail: ["Expedientes", "Disposición final (TRD)"] },
  { re: /^\/expedientes\/[^/]+\/ficha-firma/, trail: ["Expedientes", "Expediente", "Ficha de firma"] },
  { re: /^\/expedientes\/[^/]+\/visitas\//, trail: ["Expedientes", "Expediente", "Hoja de visita"] },
  { re: /^\/expedientes\/[^/]+/, trail: ["Expedientes", "Expediente"] },
  { re: /^\/expedientes$/, trail: ["Expedientes"] },
  { re: /^\/visor-tramites/, trail: ["Visor de trámites"] },
  { re: /^\/planeador\/buzon/, trail: ["Planeador", "Buzón de visitas"] },
  { re: /^\/planeador/, trail: ["Planeador", "Calendario"] },
  { re: /^\/solicitantes\/nuevo/, trail: ["Solicitantes", "Nuevo solicitante"] },
  { re: /^\/solicitantes\/[^/]+/, trail: ["Solicitantes", "Solicitante"] },
  { re: /^\/solicitantes$/, trail: ["Solicitantes"] },
  { re: /^\/firmas\/firmar\/[^/]+/, trail: ["Firmas", "Firmar documento"] },
  { re: /^\/firmas\/buzon/, trail: ["Firmas", "Buzón de firmas"] },
  { re: /^\/firmas\/mis-firmas/, trail: ["Firmas", "Mis firmas"] },
  { re: /^\/firmas\/rechazos/, trail: ["Firmas", "Rechazos al firmar"] },
];

export function MigaTramites() {
  return <MigaModulo inicio={{ label: "Trámites 2.0", href: "/" }} inicioGrupo={INICIO_GRUPO} rutas={RUTAS} />;
}
