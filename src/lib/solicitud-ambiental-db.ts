import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { generarNumeroSolicitud } from "@/lib/solicitud-ambiental";

export async function numeroSolicitudLibre(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const n = generarNumeroSolicitud();
    if ((await db.expediente.count({ where: { codigoSolicitudPublica: n } })) === 0) return n;
  }
  throw new Error("No se pudo asignar un número de solicitud. Intente de nuevo.");
}

/**
 * Usuario de sistema que figura como creador de los expedientes radicados en línea (el expediente
 * exige un creador). Queda inactivo: no puede iniciar sesión ni aparece en las listas de funcionarios.
 */
export const CORREO_VENTANILLA_VIRTUAL = "ventanilla-virtual@sic.sistema";

export async function usuarioVentanillaVirtual(): Promise<{ id: string; nombre: string }> {
  return db.usuario.upsert({
    where: { email: CORREO_VENTANILLA_VIRTUAL },
    create: {
      email: CORREO_VENTANILLA_VIRTUAL,
      nombre: "Ventanilla virtual (solicitud en línea)",
      // Hash imposible de igualar: la cuenta nunca autentica.
      passwordHash: `!sin-acceso-${randomBytes(24).toString("hex")}`,
      activo: false,
      estadoCuenta: "DESHABILITADA",
      accesoFirma: false,
    },
    update: { activo: false, estadoCuenta: "DESHABILITADA" },
    select: { id: true, nombre: true },
  });
}
