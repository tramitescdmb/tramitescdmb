import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { verificarSesion as getSession } from "@/lib/permisos";

/**
 * El catálogo de trámites se cachea (unstable_cache, tag "tramites") porque
 * casi nunca cambia — pero esa caché sobrevive a un nuevo despliegue (es la
 * "Data Cache" de Next.js/Vercel, separada del build). Cuando se actualizan
 * los datos de un trámite directamente en la base (ej. `prisma/seed.ts` tras
 * editar un JSON en data/tramites/), hay que invalidar esta caché a mano
 * para que el sitio deje de servir la versión vieja — si no, puede tardar
 * hasta 5 minutos (el `revalidate: 300` de respaldo) o mostrar datos
 * desactualizados/incompletos si el esquema cambió (campo nuevo = undefined
 * en la caché vieja).
 */
export async function POST() {
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede refrescar la caché." }, { status: 403 });
  }

  revalidateTag("tramites");

  return NextResponse.json({ ok: true });
}
