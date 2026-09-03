"use client";

import { useEffect, useState } from "react";

/**
 * Ancho de cada columna de una tabla, ajustable arrastrando el borde (como en
 * Excel). Se recuerda en localStorage del navegador — es una comodidad de
 * cada quien, no se sincroniza entre dispositivos ni usuarios.
 */
export function useAnchosColumna(clave: string, anchosPorDefecto: number[]) {
  const [anchos, setAnchos] = useState<number[]>(anchosPorDefecto);

  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(`anchos-tabla:${clave}`);
      if (!guardado) return;
      const parsed = JSON.parse(guardado);
      if (Array.isArray(parsed) && parsed.length === anchosPorDefecto.length && parsed.every((n) => typeof n === "number")) {
        setAnchos(parsed);
      }
    } catch {
      // localStorage puede fallar (modo privado, cuota agotada) — se queda con los anchos por defecto.
    }
    // Solo al montar: si `clave` cambiara en caliente no tiene sentido re-disparar esto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  function cambiarAncho(indice: number, ancho: number) {
    setAnchos((prev) => {
      const next = [...prev];
      next[indice] = Math.max(50, Math.round(ancho));
      try {
        window.localStorage.setItem(`anchos-tabla:${clave}`, JSON.stringify(next));
      } catch {
        // idem
      }
      return next;
    });
  }

  function restablecer(indice: number) {
    cambiarAncho(indice, anchosPorDefecto[indice]);
  }

  return { anchos, cambiarAncho, restablecer };
}
