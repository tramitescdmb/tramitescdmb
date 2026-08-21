import { db } from "@/lib/db";
import type { TipoAuditoria } from "@prisma/client";

export async function registrarAuditoria(datos: {
  tipo: TipoAuditoria;
  descripcion: string;
  usuarioId?: string | null;
  emailIntento?: string | null;
}) {
  await db.registroAuditoria.create({
    data: {
      tipo: datos.tipo,
      descripcion: datos.descripcion,
      usuarioId: datos.usuarioId ?? null,
      emailIntento: datos.emailIntento ?? null,
    },
  });
}
