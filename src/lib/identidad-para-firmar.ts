import { db } from "@/lib/db";
import { cargoDelFirmante, esContratista, type ModuloFirma } from "@/lib/jerarquia-firma";
import { identidadFirmante } from "@/lib/contratacion";
import { textoIdentificacionFirma } from "@/lib/identificacion-firma";
import { supervisoresDelExpediente } from "@/lib/firmantes-gecon";

export type IdentidadParaFirmar = {
  nombre: string;
  cargo: string;
  actoAdministrativo: string | null;
  identificacion: string | null;
  dependencia: string | null;
  encargo: boolean;
  faltantes: string[];
};

export function esModuloFirma(v: unknown): v is ModuloFirma {
  return v === "SGDEA" || v === "TRAMITES" || v === "GECON";
}

export async function identidadParaFirmar(
  usuarioId: string,
  opciones: { modulo: ModuloFirma; solicitudId?: string | null }
): Promise<IdentidadParaFirmar | null> {
  let modulo = opciones.modulo;
  let supervisaElExpediente = false;
  if (opciones.solicitudId) {
    const s = await db.solicitudFirma.findUnique({
      where: { id: opciones.solicitudId },
      select: { usuarioAsignadoId: true, documentoExpedienteId: true, documentoContrato: { select: { expedienteId: true } } },
    });
    if (s && s.usuarioAsignadoId === usuarioId) {
      modulo = s.documentoContrato ? "GECON" : s.documentoExpedienteId ? "TRAMITES" : "SGDEA";
      if (s.documentoContrato) supervisaElExpediente = (await supervisoresDelExpediente(s.documentoContrato.expedienteId)).has(usuarioId);
    }
  }

  const u = await db.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      nombre: true,
      cedulaONit: true,
      tipoIdentificacionFirma: true,
      denominacionEmpleo: true,
      denominacionComplemento: true,
      denominacionEncargo: true,
      actoAdministrativoCargo: true,
      sexo: true,
      rolesContratacion: true,
      dependencia: { select: { nombre: true } },
      contratista: { select: { identificacion: true, contactoEmail: true, tipoPersona: true } },
    },
  });
  if (!u) return null;

  const identidad = identidadFirmante(u);
  const identificacion = textoIdentificacionFirma(identidad.cedulaONit, identidad.tipoIdentificacion);
  const contratista = esContratista(u);
  const faltantes: string[] = [];
  if (!identificacion) faltantes.push("número de identificación");
  if (!contratista && !u.denominacionEmpleo) faltantes.push("denominación del empleo (cargo)");
  if (!contratista && !u.dependencia) faltantes.push("dependencia");

  return {
    nombre: u.nombre,
    cargo: cargoDelFirmante({ ...u, supervisaElExpediente }, modulo),
    actoAdministrativo: u.actoAdministrativoCargo?.trim() || null,
    identificacion,
    dependencia: u.dependencia?.nombre ?? null,
    encargo: u.denominacionEncargo,
    faltantes,
  };
}
