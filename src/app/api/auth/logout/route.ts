import { NextRequest, NextResponse } from "next/server";
import { destroySessionCookie } from "@/lib/auth";
import {
  borrarTokenDirectorioActivo,
  cerrarSesionDirectorioActivo,
  leerTokenDirectorioActivo,
} from "@/lib/directorio-activo";

export async function POST(req: NextRequest) {
  // Si el funcionario entró por directorio activo, también se cierra la sesión
  // en ese API (mejor esfuerzo: aunque falle, se cierra la sesión de la app).
  const daToken = await leerTokenDirectorioActivo();
  if (daToken) {
    await cerrarSesionDirectorioActivo(daToken);
    await borrarTokenDirectorioActivo();
  }

  await destroySessionCookie();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
