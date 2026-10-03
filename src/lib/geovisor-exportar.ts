// Funciones puras para las descargas del visor de trámites (GeoJSON / CSV /
// reporte HTML / enlace de zona). Separadas del componente para poder
// probarlas — mismo criterio que geovisor_exportar.dart en Negocios Verdes.

export type PuntoReporte = {
  id: string;
  numero: string;
  tramiteCodigo: string;
  tramiteNombre: string;
  municipio: string;
  estado: string;
  solicitanteNombre: string;
  fechaRadicacion: string;
  lat: number;
  lon: number;
  plataforma?: string;
  enlace?: string;
};

export const PLATAFORMA_TRAMITES_2 = "Trámites ambientales 2.0";

function plataformaDe(p: PuntoReporte): string {
  return p.plataforma ?? PLATAFORMA_TRAMITES_2;
}

function enlaceDe(p: PuntoReporte, origen: string): string {
  return `${origen}${p.enlace ?? `/expedientes/${p.id}`}`;
}

function tramiteDe(p: PuntoReporte): string {
  return p.tramiteCodigo ? `${p.tramiteCodigo} — ${p.tramiteNombre}` : p.tramiteNombre;
}

export type CapaContextoReporte = { titulo: string; elementos: string[] };

export const FUENTES_CAPAS_EXTERNAS = [
  "Cartografía base: © OpenStreetMap (ODbL)",
  "Áreas protegidas: RUNAP — Parques Nacionales Naturales de Colombia",
  "Páramos delimitados: MADS — Ministerio de Ambiente y Desarrollo Sostenible",
  "Veredas: DANE (nivel de referencia veredal)",
  "Hidrografía y subzonas hidrográficas: IDEAM",
  "Áreas de conservación de aves (AICA): Instituto Humboldt",
  "Bosque seco tropical: MADS",
  "Datos de trámites: CDMB",
];

function csvCampo(v: string): string {
  return /[,"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function csvTramites(puntos: PuntoReporte[], origen: string): string {
  const filas = [
    "plataforma,numero,tramite,solicitante,municipio,estado,fecha_radicacion,latitud,longitud,ficha",
    ...puntos.map((p) =>
      [
        csvCampo(plataformaDe(p)),
        csvCampo(p.numero),
        csvCampo(tramiteDe(p)),
        csvCampo(p.solicitanteNombre),
        csvCampo(p.municipio),
        csvCampo(p.estado.replaceAll("_", " ")),
        csvCampo(p.fechaRadicacion.slice(0, 10)),
        p.lat.toFixed(6),
        p.lon.toFixed(6),
        enlaceDe(p, origen),
      ].join(","),
    ),
  ];
  return filas.join("\n") + "\n";
}

function featureTramite(p: PuntoReporte, origen: string) {
  return {
    type: "Feature" as const,
    properties: {
      plataforma: plataformaDe(p),
      numero: p.numero,
      tramite: tramiteDe(p),
      solicitante: p.solicitanteNombre,
      municipio: p.municipio,
      estado: p.estado,
      ficha: enlaceDe(p, origen),
    },
    geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
  };
}

export function geoJsonTramites(
  puntos: PuntoReporte[],
  opts: {
    zona?: [number, number][];
    areaM2?: number;
    perimetroM?: number;
    contexto?: CapaContextoReporte[];
    origen: string;
  },
): string {
  const { zona, areaM2, perimetroM, contexto = [], origen } = opts;
  const features: object[] = [];
  if (zona && zona.length >= 3) {
    const ctx: Record<string, string[]> = {};
    for (const c of contexto) if (c.elementos.length > 0) ctx[c.titulo] = c.elementos;
    features.push({
      type: "Feature",
      properties: {
        tipo: "zona_seleccionada",
        ...(areaM2 !== undefined ? { area_km2: Number((areaM2 / 1e6).toFixed(3)) } : {}),
        ...(perimetroM !== undefined ? { perimetro_km: Number((perimetroM / 1000).toFixed(3)) } : {}),
        tramites: puntos.length,
        ...(Object.keys(ctx).length > 0 ? { contexto: ctx } : {}),
        generado: new Date().toISOString().slice(0, 19),
        fuente: `Visor de trámites CDMB — ${origen}`,
      },
      geometry: {
        type: "Polygon",
        coordinates: [[...zona.map(([lat, lon]) => [lon, lat]), [zona[0]![1], zona[0]![0]]]],
      },
    });
  }
  for (const p of puntos) features.push(featureTramite(p, origen));
  return JSON.stringify(
    {
      type: "FeatureCollection",
      name: "visor_tramites_cdmb",
      crs: { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } },
      fuente: `Visor de trámites de la CDMB — ${origen}`,
      fuentes_capas_externas: FUENTES_CAPAS_EXTERNAS,
      features,
    },
    null,
    2,
  );
}

function esc(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function bloqueContexto(contexto: CapaContextoReporte[]): string {
  const conDatos = contexto.filter((c) => c.elementos.length > 0);
  if (conDatos.length === 0) return "";
  let b = "<h2>Qué toca la zona</h2>";
  for (const c of conDatos) {
    b += `<h3>${esc(c.titulo)} (${c.elementos.length})</h3><ul>`;
    for (const e of c.elementos) b += `<li>${esc(e)}</li>`;
    b += "</ul>";
  }
  return b;
}

export function htmlReporte(opts: {
  titulo: string;
  puntos: PuntoReporte[];
  zona?: [number, number][];
  areaM2?: number;
  perimetroM?: number;
  contexto?: CapaContextoReporte[];
  origen: string;
}): string {
  const { titulo, puntos, zona = [], areaM2, perimetroM, contexto = [], origen } = opts;
  const hoy = new Date().toISOString().slice(0, 10);
  const marcadores = puntos.map((p) => [p.lat, p.lon, `${plataformaDe(p)}: ${p.numero} — ${tramiteDe(p)}`]);
  const zonaJs = JSON.stringify(zona);
  const marcadoresJs = JSON.stringify(marcadores);
  const hayMapa = zona.length > 0 || marcadores.length > 0;
  const mapa = !hayMapa
    ? ""
    : `<div id="mapa" class="mapa"></div>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script>
(function(){
  var zona = ${zonaJs}, puntos = ${marcadoresJs};
  var m = L.map('mapa', {scrollWheelZoom:false});
  // No tile.openstreetmap.org: este reporte se abre como archivo local (sin
  // Referer) y OSM responde 403 a cada tesela. Esri no exige Referer ni key.
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {maxZoom:19, attribution:'Imágenes &copy; Esri, Maxar, Earthstar Geographics'}).addTo(m);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    {maxZoom:19}).addTo(m);
  var grupo = [];
  if (zona.length >= 3) {
    var poly = L.polygon(zona, {color:'#166534', weight:2, fillOpacity:0.10}).addTo(m);
    grupo.push(poly);
  }
  puntos.forEach(function(x){
    var mk = L.circleMarker([x[0], x[1]],
      {radius:6, color:'#ffffff', fillColor:'#166534', fillOpacity:0.95, weight:2})
      .addTo(m).bindPopup(x[2]);
    grupo.push(mk);
  });
  if (grupo.length) m.fitBounds(L.featureGroup(grupo).getBounds().pad(0.15));
  else m.setView([7.1,-73.1], 10);
})();
</script>`;

  const conteoPlataforma = new Map<string, number>();
  for (const p of puntos) conteoPlataforma.set(plataformaDe(p), (conteoPlataforma.get(plataformaDe(p)) ?? 0) + 1);
  const porPlataforma = conteoPlataforma.size > 1 ? [...conteoPlataforma.entries()] : [];
  const porMunicipio = new Map<string, number>();
  for (const p of puntos) porMunicipio.set(p.municipio, (porMunicipio.get(p.municipio) ?? 0) + 1);
  const munOrd = [...porMunicipio.entries()].sort((a, b) => b[1] - a[1]);

  const ordenados = [...puntos].sort((a, b) => plataformaDe(a).localeCompare(plataformaDe(b)) || a.numero.localeCompare(b.numero));
  const filas = ordenados
    .map(
      (p) =>
        `<tr><td>${esc(plataformaDe(p))}</td><td>${esc(p.numero)}</td><td>${esc(tramiteDe(p))}</td>` +
        `<td>${esc(p.solicitanteNombre)}</td><td>${esc(p.municipio)}</td><td>${esc(p.estado.replaceAll("_", " "))}</td>` +
        `<td><a href="${enlaceDe(p, origen)}">ver en ${esc(plataformaDe(p))}</a></td></tr>`,
    )
    .join("\n");

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${esc(titulo)} — Trámites CDMB</title>
<style>
  body{font:14px/1.5 system-ui,Segoe UI,Roboto,sans-serif;color:#1a1a1a;max-width:900px;margin:24px auto;padding:0 16px}
  h1{font-size:20px;margin:0 0 4px} .sub{color:#666;margin:0 0 20px}
  .kpis{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}
  .kpi{border:1px solid #ddd;border-radius:8px;padding:10px 14px;min-width:120px}
  .kpi b{display:block;font-size:20px;color:#166534}
  table{border-collapse:collapse;width:100%;margin-top:12px;font-size:12.5px}
  th,td{border:1px solid #e2e2e2;padding:6px 8px;text-align:left;vertical-align:top}
  th{background:#f2f7f4}
  h2{font-size:15px;margin:22px 0 6px;border-bottom:2px solid #166534;padding-bottom:2px}
  h3{font-size:13px;margin:12px 0 2px;color:#333}
  ul{margin:6px 0 0 18px}
  .pie{color:#888;font-size:11px;margin-top:28px;border-top:1px solid #ddd;padding-top:8px}
  .mapa{width:100%;height:360px;border:1px solid #ddd;border-radius:8px;margin-top:8px}
  .btn{display:inline-block;margin:8px 0;padding:8px 16px;background:#166534;color:#fff;border:0;border-radius:6px;font:inherit;cursor:pointer}
  @media print{a{color:inherit;text-decoration:none} .btn{display:none} .mapa{height:300px}}
</style></head><body>
<h1>${esc(titulo)}</h1>
<p class="sub">Visor de trámites — CDMB · generado el ${hoy}</p>
<button class="btn" onclick="window.print()">Imprimir / Guardar como PDF</button>
${mapa}
<div class="kpis">
  <div class="kpi"><b>${puntos.length}</b>trámites</div>
${porPlataforma.map(([pl, n]) => `  <div class="kpi"><b>${n}</b>${esc(pl)}</div>`).join("\n")}
  <div class="kpi"><b>${munOrd.length}</b>municipios</div>
${areaM2 !== undefined ? `  <div class="kpi"><b>${(areaM2 / 1e6).toFixed(2)}</b>km² de área</div>` : ""}
${perimetroM !== undefined ? `  <div class="kpi"><b>${(perimetroM / 1000).toFixed(2)}</b>km de perímetro</div>` : ""}
</div>
${munOrd.length === 0 ? "" : `<h2>Por municipio</h2><ul>${munOrd.map(([m, n]) => `<li>${esc(m)}: ${n}</li>`).join("")}</ul>`}
${bloqueContexto(contexto)}
<h2>Fuentes de las capas</h2>
<ul>${FUENTES_CAPAS_EXTERNAS.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
<h2>Trámites (${puntos.length})</h2>
<table><thead><tr><th>Plataforma</th><th>Número</th><th>Trámite</th><th>Solicitante</th><th>Municipio</th><th>Estado</th><th></th></tr></thead>
<tbody>
${filas}
</tbody></table>
<p class="pie">Fuente: Visor de trámites de la CDMB (${origen}). ${esc(FUENTES_CAPAS_EXTERNAS.join(". "))}. Las capas de contexto son externas, de cada entidad citada. Este reporte es informativo y no constituye cartografía oficial de linderos.</p>
</body></html>`;
}

export function zonaAParam(zona: [number, number][]): string | null {
  if (zona.length < 3) return null;
  return zona.map(([lat, lon]) => `${lat.toFixed(5)},${lon.toFixed(5)}`).join(";");
}

export function parseZonaParam(s: string | null | undefined): [number, number][] {
  if (!s) return [];
  const out: [number, number][] = [];
  for (const par of s.split(";")) {
    const [latS, lonS] = par.split(",");
    const lat = Number(latS);
    const lon = Number(lonS);
    if (Number.isFinite(lat) && Number.isFinite(lon)) out.push([lat, lon]);
  }
  return out;
}
