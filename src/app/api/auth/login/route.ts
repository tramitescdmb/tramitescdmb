import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const next = String(form.get("next") || "/");

  const fail = (message: string) => {
    const url = new URL("/login", req.url);
    url.searchParams.set("error", message);
    if (next && next !== "/") url.searchParams.set("next", next);
    return NextResponse.redirect(url, { status: 303 });
  };

  if (!email || !password) return fail("Correo y contraseña son obligatorios.");

  const usuario = await db.usuario.findUnique({ where: { email } });
  if (!usuario || !usuario.activo) return fail("Credenciales inválidas.");

  const valido = await verifyPassword(password, usuario.passwordHash);
  if (!valido) return fail("Credenciales inválidas.");

  await createSessionCookie({
    userId: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    rol: usuario.rol,
  });

  const redirectTo = next && next.startsWith("/") ? next : "/";
  return NextResponse.redirect(new URL(redirectTo, req.url), { status: 303 });
}
