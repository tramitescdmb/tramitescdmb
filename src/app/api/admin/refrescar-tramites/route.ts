import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { verificarSesion as getSession } from "@/lib/permisos";

export async function POST() {
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede refrescar la caché." }, { status: 403 });
  }

  revalidateTag("tramites");

  return NextResponse.json({ ok: true });
}
