/** Único botón "Descargar CSV" — se ubica arriba a la derecha de la pantalla, junto al título. */
export function DescargarCsvBoton({ href, cantidad }: { href: string; cantidad: string }) {
  return (
    // eslint-disable-next-line @next/next/no-html-link-for-pages -- descarga de archivo (ruta de API), no una página
    <a
      href={href}
      className="inline-flex flex-none items-center gap-1.5 rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 transition-transform hover:bg-stone-50 active:scale-95"
    >
      ⬇ Descargar CSV ({cantidad === "todos" ? "todos" : cantidad})
    </a>
  );
}
