import Link from "next/link";
import { segmentosTexto } from "@/lib/manual-demostracion";

export function TextoManual({ texto }: { texto: string }) {
  return (
    <>
      {segmentosTexto(texto).map((s, i) => {
        if (s.tipo === "codigo") {
          return (
            <code key={i} className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[0.92em] text-stone-800">
              {s.valor}
            </code>
          );
        }
        if (s.tipo === "negrita") return <strong key={i} className="font-semibold text-stone-800">{s.valor}</strong>;
        if (s.tipo === "enlace") {
          return s.destino.startsWith("/") ? (
            <Link key={i} prefetch={false} href={s.destino} className="font-medium text-cdmb-700 hover:underline">
              {s.valor}
            </Link>
          ) : (
            <a key={i} href={s.destino} target="_blank" rel="noreferrer" className="font-medium text-cdmb-700 hover:underline">
              {s.valor}
            </a>
          );
        }
        return <span key={i}>{s.valor}</span>;
      })}
    </>
  );
}
