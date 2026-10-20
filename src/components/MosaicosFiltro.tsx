import Link from "next/link";

export type Mosaico = { clave: string; etiqueta: string; valor: number; href: string; color: string; activo: boolean };

function textoSobre(hex: string): string {
  const v = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luz = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return luz > 0.22 ? "#1b2a20" : "#ffffff";
}

export function MosaicosFiltro({ mosaicos }: { mosaicos: Mosaico[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(8.75rem,1fr))] gap-2">
      {mosaicos.map((m) => (
        <Link
          key={m.clave}
          href={m.href}
          aria-current={m.activo ? "true" : undefined}
          style={{ backgroundColor: m.color, color: textoSobre(m.color) }}
          className={`flex min-h-[3.75rem] flex-col justify-between rounded px-2.5 py-2 transition hover:brightness-95 ${
            m.activo ? "ring-2 ring-stone-900 ring-offset-1" : ""
          }`}
        >
          <span className="text-lg font-semibold leading-none tabular-nums">{m.valor.toLocaleString("es-CO")}</span>
          <span className="truncate text-xs leading-tight opacity-95" title={m.etiqueta}>
            {m.etiqueta}
          </span>
        </Link>
      ))}
    </div>
  );
}
