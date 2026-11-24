/** Franja verde con el título centrado, encabezado de las páginas fijas (igual a la plataforma anterior). */
export function BandaTituloNV({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  return (
    <div className="bg-nv-menu px-5 py-6 text-center">
      <h1 className="text-[26px] font-semibold leading-tight">{titulo}</h1>
      {subtitulo && <p className="mx-auto mt-1 max-w-[640px] text-sm">{subtitulo}</p>}
    </div>
  );
}
