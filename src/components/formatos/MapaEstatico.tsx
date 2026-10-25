import { ATRIBUCION_MAPA, teselasMapa } from "@/lib/mapa-estatico";

export function MapaEstatico({ lat, lon, pie, className = "" }: { lat: number; lon: number; pie?: string; className?: string }) {
  const m = teselasMapa(lat, lon);
  return (
    <figure className={`break-inside-avoid ${className}`}>
      <div className="relative w-full overflow-hidden border border-stone-300 bg-stone-100" style={{ aspectRatio: `${m.columnas} / ${m.filas}` }}>
        {m.teselas.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={t.url}
            src={t.url}
            alt=""
            crossOrigin="anonymous"
            className="absolute max-w-none select-none"
            style={{ left: `${(t.col / m.columnas) * 100}%`, top: `${(t.fila / m.filas) * 100}%`, width: `${100 / m.columnas + 0.2}%`, height: `${100 / m.filas + 0.2}%` }}
          />
        ))}
        <span
          className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-600 shadow"
          style={{ left: `${m.punto.fx * 100}%`, top: `${m.punto.fy * 100}%` }}
          aria-hidden
        />
        <span className="absolute bottom-0 right-0 bg-white/80 px-1 text-[8px] text-stone-600">{ATRIBUCION_MAPA}</span>
      </div>
      {pie && <figcaption className="mt-1 text-center text-[10px] italic text-stone-600">{pie}</figcaption>}
    </figure>
  );
}
