"use client";

import { useEffect, useState } from "react";
import { Cloud, CloudOff } from "lucide-react";
import { ARCHIVOS_CAPAS } from "@/lib/zonificacion";

async function guardarParaUsoSinConexion() {
  if (!("caches" in window)) return;
  const recursos = performance
    .getEntriesByType("resource")
    .map((e) => e.name)
    .filter((u) => {
      const url = new URL(u);
      return url.origin === location.origin && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/geo/"));
    });
  recursos.push(...Object.values(ARCHIVOS_CAPAS).map((r) => new URL(r, location.origin).href));
  const estaticos = await caches.open("estaticos-v1");
  await Promise.all(recursos.map((u) => estaticos.match(u).then((ya) => (ya ? null : estaticos.add(u).catch(() => null)))));
  const paginas = await caches.open("hojas-visita-v1");
  await paginas.add(location.pathname).catch(() => null);
}

export function ModoSinConexion() {
  const [listo, setListo] = useState(false);
  const [enLinea, setEnLinea] = useState(true);

  useEffect(() => {
    setEnLinea(navigator.onLine);
    const on = () => setEnLinea(true);
    const off = () => setEnLinea(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then(() => navigator.serviceWorker.ready)
        .then(() => guardarParaUsoSinConexion())
        .then(() => setListo(true))
        .catch(() => setListo(false));
    }
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!enLinea) {
    return (
      <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <CloudOff className="h-3.5 w-3.5 flex-none" aria-hidden />
        Sin conexión. Puede seguir diligenciando: la hoja y las fotos se guardan en este dispositivo y se enviarán al recuperar la señal.
      </p>
    );
  }
  if (!listo) return null;
  return (
    <p className="flex items-center gap-1.5 text-[11px] text-stone-400">
      <Cloud className="h-3.5 w-3.5 flex-none" aria-hidden />
      Disponible sin conexión en este dispositivo.
    </p>
  );
}
