/**
 * Aparte de `directorio-activo.ts` a propósito: ese archivo importa `next/headers` (cookies()),
 * lo que lo vuelve "server-only" para el bundler de Next — cualquier módulo que lo importe queda
 * inservible desde un Client Component, aunque solo use un export puro de ahí. `contratacion.ts`
 * SÍ se importa desde componentes de cliente (ej. `CatalogoRequisitosAdmin.tsx`, solo por sus
 * constantes/tipos), así que esta función pura vive en su propio archivo sin esa dependencia.
 */

/** Nombre provisional a partir del usuario de red ("jperez" → "Jperez", "j.perez_lopez" →
 * "J Perez Lopez") — se usa al dar de alta automáticamente una cuenta de directorio activo, sea
 * al iniciar sesión por primera vez o al pre-vincularla desde un Contratista antes de que la
 * persona entre nunca. Queda como nombre provisional: se reemplaza solo si la persona entra y su
 * nombre real llega por otro medio (hoy no hay ese medio, así que en la práctica es definitivo
 * salvo que un administrador lo edite). */
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
