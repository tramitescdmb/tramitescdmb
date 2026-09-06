import { NextRequest, NextResponse } from "next/server";
import { refreshSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/sinca/sincronizar", "/api/admin/vital/sincronizar"];
// Ventanilla pública de PQRSD (Fase 3, sin autenticación) y su API: única zona
// pública por PREFIJO del proyecto — todo lo demás sigue siendo allow-list exacta.
const PUBLIC_PREFIXES = ["/pqrsd", "/api/pqrsd"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const resultado = token ? await refreshSessionToken(token) : null;

  if (!resultado) {
    const loginUrl = new URL("/login", req.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
    const res = NextResponse.redirect(loginUrl);
    if (token) res.cookies.delete(SESSION_COOKIE_NAME); // token vencido (inactividad o tope de 7 días) o inválido
    return res;
  }

  // Renueva la ventana de inactividad (MoReq 6.21/6.34) en cada petición autenticada.
  const res = NextResponse.next();
  res.cookies.set(SESSION_COOKIE_NAME, resultado.nuevoToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: resultado.maxAge,
  });
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
