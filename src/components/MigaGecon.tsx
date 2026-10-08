"use client";

import { MigaModulo, type RutaMiga } from "@/components/MigaModulo";

const INICIO_GRUPO: Record<string, string> = {
  Panel: "/contratacion/panel",
  Expedientes: "/contratacion/expedientes",
  Firmas: "/contratacion/buzon",
  Contratistas: "/contratacion/contratistas",
  Ayuda: "/contratacion/ayuda",
};

const RUTAS: RutaMiga[] = [
  { re: /^\/contratacion\/expedientes\/nuevo/, trail: ["Expedientes", "Nuevo expediente"] },
  { re: /^\/contratacion\/expedientes\/[^/]+\/ficha-firma/, trail: ["Expedientes", "Expediente", "Ficha de firma"] },
  { re: /^\/contratacion\/expedientes\/[^/]+\/rotulo/, trail: ["Expedientes", "Expediente", "Rótulo"] },
  { re: /^\/contratacion\/expedientes\/[^/]+/, trail: ["Expedientes", "Expediente"] },
  { re: /^\/contratacion\/expedientes$/, trail: ["Expedientes"] },
  { re: /^\/contratacion\/firmar\/[^/]+/, trail: ["Firmas", "Firmar documento"] },
  { re: /^\/contratacion\/buzon/, trail: ["Firmas", "Buzón de firmas"] },
  { re: /^\/contratacion\/mis-firmas/, trail: ["Firmas", "Mis firmas"] },
  { re: /^\/contratacion\/rechazos-firma/, trail: ["Firmas", "Rechazos al firmar"] },
  { re: /^\/contratacion\/disposicion/, trail: ["Administración", "Disposición final (TRD)"] },
  { re: /^\/contratacion\/panel\/expedientes/, trail: ["Panel", "Expedientes"] },
  { re: /^\/contratacion\/panel\/indicadores/, trail: ["Panel", "Indicadores"] },
  { re: /^\/contratacion\/panel\/sistema/, trail: ["Panel", "Sistema"] },
  { re: /^\/contratacion\/panel/, trail: ["Panel", "Mi trabajo pendiente"] },
  { re: /^\/contratacion\/contratistas\/[^/]+/, trail: ["Contratistas", "Contratista"] },
  { re: /^\/contratacion\/contratistas$/, trail: ["Contratistas"] },
  { re: /^\/contratacion\/catalogo/, trail: ["Configuración", "Catálogo de requisitos"] },
  { re: /^\/contratacion\/bitacora/, trail: ["Administración", "Bitácora del GECON"] },
  { re: /^\/contratacion\/auditoria/, trail: ["Administración", "Auditoría de cuentas"] },
  { re: /^\/contratacion\/seguridad/, trail: ["Administración", "Seguridad"] },
  { re: /^\/contratacion\/ayuda/, trail: ["Ayuda"] },
];

export function MigaGecon() {
  return <MigaModulo inicio={{ label: "GECON", href: "/contratacion/panel" }} inicioGrupo={INICIO_GRUPO} rutas={RUTAS} />;
}
