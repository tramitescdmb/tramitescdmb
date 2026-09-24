export function nombreInicialDesdeUsuarioRed(usuarioRed: string): string {
  return (
    usuarioRed
      .split("@")[0]!
      .split(/[.\-_]+/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ") || usuarioRed
  );
}
