import type { CalidadFirma, RolFirmante } from "@prisma/client";
import { esCalidadFirma } from "@/lib/calidad-firma";

const ROLES_VALIDOS: RolFirmante[] = ["FIRMA", "VISTO_BUENO", "LECTURA"];

export type FirmanteSolicitado = { usuarioId: string; rol: RolFirmante; calidad: CalidadFirma | null };

export function leerFirmantesSolicitud(body: unknown): { firmantes: FirmanteSolicitado[] } | { error: string } {
  const lista = (body as { firmantes?: unknown } | null)?.firmantes;
  if (!Array.isArray(lista) || lista.length === 0) return { error: "Debe indicar al menos una persona." };
  const firmantes: FirmanteSolicitado[] = [];
  for (const f of lista as { usuarioId?: unknown; rol?: unknown; calidad?: unknown }[]) {
    if (typeof f?.usuarioId !== "string" || !ROLES_VALIDOS.includes(f?.rol as RolFirmante)) {
      return { error: "Datos de firmante inválidos." };
    }
    const rol = f.rol as RolFirmante;
    firmantes.push({ usuarioId: f.usuarioId, rol, calidad: rol === "FIRMA" ? (esCalidadFirma(f.calidad) ? f.calidad : "PRINCIPAL") : null });
  }
  return { firmantes };
}
