import { NextRequest, NextResponse } from "next/server";
import { destroySessionCookie } from "@/lib/auth";
import {
  borrarTokenDirectorioActivo,
  cerrarSesionDirectorioActivo,
  leerTokenDirectorioActivo,
} from "@/lib/directorio-activo";

export async function POST(req: NextRequest) {
  const daToken = await leerTokenDirectorioActivo();
  if (daToken) {
    await cerrarSesionDirectorioActivo(daToken);
    await borrarTokenDirectorioActivo();
  }

  await destroySessionCookie();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
