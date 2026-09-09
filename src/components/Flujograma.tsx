"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Dibuja un flujo de trabajo como flujograma con Mermaid (librería libre, MIT).
 * Recibe la definición ya armada por `flujoAMermaid()` — este componente solo
 * pinta. Se carga Mermaid de forma diferida (dynamic import) para no pesar en el
 * bundle de quien no abre un flujo.
 */
export function Flujograma({ definicion }: { definicion: string }) {
  const host = useRef<HTMLDivElement>(null);
  const contador = useRef(0);
  const baseId = "fg" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando");

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          flowchart: { htmlLabels: false, curve: "basis", padding: 8, nodeSpacing: 30, rankSpacing: 36 },
          themeVariables: {
            fontFamily: "Archivo, system-ui, sans-serif",
            fontSize: "13px",
            primaryColor: "#ffffff",
            primaryBorderColor: "#d7dfd9",
            primaryTextColor: "#182420",
            lineColor: "#9aa79e",
            edgeLabelBackground: "#f3f6f4",
          },
        });
        const { svg } = await mermaid.render(`${baseId}-${contador.current++}`, definicion);
        if (!vivo) return;
        if (host.current) host.current.innerHTML = svg;
        setEstado("listo");
      } catch {
        if (vivo) setEstado("error");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [definicion, baseId]);

  if (estado === "error") {
    return <p className="text-xs text-stone-400">No se pudo dibujar el diagrama del flujo.</p>;
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50/60 p-3">
      <div
        ref={host}
        aria-label="Diagrama del flujo de trabajo"
        className="overflow-x-auto [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
      />
      {estado === "cargando" && <p className="text-xs text-stone-400">Dibujando el flujograma…</p>}
    </div>
  );
}
