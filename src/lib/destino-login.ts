export function destinoTrasIngreso(next: string | null | undefined): string {
  const destino = next?.trim() ?? "";
  if (!destino.startsWith("/") || destino.startsWith("//") || destino.startsWith("/\\")) return "/";
  if (destino === "/login" || destino.startsWith("/login?") || destino.startsWith("/api/auth/")) return "/";
  return destino;
}
