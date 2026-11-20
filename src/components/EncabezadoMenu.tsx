import Link from "next/link";
import { IconLeaf } from "@tabler/icons-react";

/**
 * Franja de marca del menú lateral: color sólido (tono oscuro del color escogido) con la hoja,
 * línea de acento abajo. Sin degradados para que se vea uniforme en todos los colores. Contraída solo muestra el logo.
 */
export function EncabezadoMenu({
  logoUrl,
  colapsado = false,
  enlace = true,
  conHoja = true,
}: {
  logoUrl: string | null;
  colapsado?: boolean;
  enlace?: boolean;
  conHoja?: boolean;
}) {
  const contenido = (
    <>
      {!colapsado && conHoja && <IconLeaf className="pointer-events-none absolute right-3 top-1/2 h-11 w-11 -translate-y-1/2 text-white/[0.08]" stroke={1.5} aria-hidden />}
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="CDMB" className="relative h-9 w-auto max-w-[5.5rem] flex-none rounded-md bg-white p-1 shadow-sm" />
      ) : (
        <span className="relative flex h-9 w-9 flex-none items-center justify-center rounded-md bg-white text-sm font-bold text-cdmb-700 shadow-sm">C</span>
      )}
      {!colapsado && (
        <span className="relative min-w-0 leading-tight">
          <span className="block truncate text-[15px] font-bold tracking-tight">SIC CDMB</span>
          <span className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-medium text-white/75">
            <IconLeaf className="h-3 w-3 flex-none text-lateral-acento" stroke={2} aria-hidden />
            Gestión ambiental
          </span>
        </span>
      )}
    </>
  );
  const clase = `relative flex flex-none items-center gap-3 overflow-hidden border-b-2 border-lateral-acento/80 bg-lateral-oscuro text-white ${
    colapsado ? "h-16 justify-center px-2" : "h-16 px-4"
  }`;
  if (!enlace) return <div className={clase}>{contenido}</div>;
  return (
    <Link prefetch={false} href="/" className={`${clase} focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white`} title={colapsado ? "SIC CDMB" : undefined}>
      {contenido}
    </Link>
  );
}
