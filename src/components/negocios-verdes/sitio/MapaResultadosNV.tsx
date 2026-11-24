"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import type { PuntoMapaNV } from "@/lib/negocios-verdes-mapa";

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Pin del mapa: círculo blanco con la foto del negocio (o el logo del programa) y borde verde. */
export function htmlPinNV(fotoUrl: string | null, tamano = 36) {
  const img = fotoUrl ?? "/negocios-verdes/iconografia/logo_negocios_verdes.png";
  return `<span style="display:flex;align-items:center;justify-content:center;width:${tamano}px;height:${tamano}px;border-radius:9999px;background:#fff;border:2px solid #01bd32;box-shadow:0 2px 5px rgba(0,0,0,.3);overflow:hidden"><img src="${esc(img)}" alt="" style="width:82%;height:82%;object-fit:contain"></span>`;
}

/** Grupo de pines: círculo verde oscuro con el número, como en la plataforma anterior. */
export function htmlGrupoNV(n: number) {
  const t = n < 10 ? 34 : n < 100 ? 40 : 46;
  return `<span style="display:flex;align-items:center;justify-content:center;width:${t}px;height:${t}px;border-radius:9999px;background:#026b4d;color:#fff;font-weight:700;font-size:14px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">${n}</span>`;
}

export function htmlAvisoNV(p: PuntoMapaNV, destino = "_self") {
  return `<div style="min-width:200px;max-width:240px;font-family:var(--font-nv),sans-serif">
    <strong style="font-size:14px;color:#1b2a20">${esc(p.nombre)}</strong><br>
    <span style="color:#5b6b60;font-size:12px">${esc(p.municipio)}${p.vereda ? ` · ${esc(p.vereda)}` : ""}</span>
    ${p.descripcionCorta ? `<p style="margin:6px 0 0;font-size:12px;color:#1b2a20">${esc(p.descripcionCorta.slice(0, 140))}</p>` : ""}
    <div style="margin-top:8px;display:flex;gap:12px;font-size:12px">
      <a href="/negocios-verdes/negocio/${encodeURIComponent(p.slug)}" target="${destino}" style="color:#026b4d;font-weight:600">Ver ficha completa</a>
      <a href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}" target="_blank" rel="noopener" style="color:#026b4d">Cómo llegar</a>
    </div></div>`;
}

/** Mapa debajo de los resultados del buscador: los negocios del resultado que tienen ubicación. */
export function MapaResultadosNV({ puntos, alto = 480, zoom = 14 }: { puntos: PuntoMapaNV[]; alto?: number; zoom?: number }) {
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let mapa: import("leaflet").Map | null = null;
    let cancelado = false;
    (async () => {
      const mod = await import("leaflet");
      const L = (mod as unknown as { default?: typeof mod }).default ?? mod;
      (window as unknown as { L: typeof L }).L = L;
      await import("leaflet.markercluster");
      if (cancelado || !caja.current) return;
      mapa = L.map(caja.current, { scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(mapa);
      const grupo = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45, iconCreateFunction: (c) => L.divIcon({ className: "", html: htmlGrupoNV(c.getChildCount()), iconSize: [40, 40] }) });
      for (const p of puntos) {
        L.marker([p.lat, p.lng], { title: p.nombre, icon: L.divIcon({ className: "", html: htmlPinNV(p.fotoUrl), iconSize: [36, 36], iconAnchor: [18, 18] }) })
          .bindPopup(htmlAvisoNV(p))
          .addTo(grupo);
      }
      grupo.addTo(mapa);
      if (puntos.length) mapa.fitBounds(L.latLngBounds(puntos.map((p) => [p.lat, p.lng] as [number, number])).pad(0.1), { maxZoom: zoom });
      else mapa.setView([7.12, -73.1], 10);
    })();
    return () => {
      cancelado = true;
      mapa?.remove();
    };
  }, [puntos, zoom]);
  return <div ref={caja} role="region" aria-label="Mapa de los resultados" style={{ height: alto }} className="z-0 overflow-hidden rounded-[12px] border border-nv-borde" />;
}
