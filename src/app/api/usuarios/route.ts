import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, hashPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede crear usuarios." }, { status: 403 });
  }

  const form = await req.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const nombre = String(form.get("nombre") || "").trim();
  const password = String(form.get("password") || "");
  const rol = String(form.get("rol") || "FUNCIONARIO") as "ADMIN" | "FUNCIONARIO";

  const url = new URL("/usuarios", req.url);

  if (!email || !nombre || password.length < 8) {
    url.searchParams.set("error", "Revisa los campos: correo, nombre y una contraseña de al menos 8 caracteres.");
    return NextResponse.redirect(url, { status: 303 });
  }

  const existente = await db.usuario.findUnique({ where: { email } });
  if (existente) {
    url.searchParams.set("error", "Ya existe un usuario con ese correo.");
    return NextResponse.redirect(url, { status: 303 });
  }

  await db.usuario.create({
    data: { email, nombre, rol, passwordHash: await hashPassword(password) },
  });

  url.searchParams.set("ok", "Usuario creado.");
  return NextResponse.redirect(url, { status: 303 });
}
