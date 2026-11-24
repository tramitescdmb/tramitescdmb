/** Medidas del geovisor (distancia, área, punto dentro de una zona) sobre coordenadas [lat, lng]. */

const R = 6371008.8; // radio medio de la Tierra en metros
const rad = (g: number) => (g * Math.PI) / 180;

/** Distancia en metros entre dos puntos (haversine). */
export function distanciaM(a: [number, number], b: [number, number]): number {
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Área en m² de un polígono pequeño (fórmula esférica de L'Huilier simplificada, la misma de Leaflet.draw). */
export function areaPoligonoM2(v: [number, number][]): number {
  if (v.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < v.length; i++) {
    const p1 = v[i]!;
    const p2 = v[(i + 1) % v.length]!;
    s += rad(p2[1] - p1[1]) * (2 + Math.sin(rad(p1[0])) + Math.sin(rad(p2[0])));
  }
  return Math.abs((s * R * R) / 2);
}

/** ¿El punto está dentro del polígono? (rayo; suficiente para zonas trazadas a mano). */
export function puntoEnPoligono(p: [number, number], v: [number, number][]): boolean {
  let dentro = false;
  for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
    const [yi, xi] = v[i]!;
    const [yj, xj] = v[j]!;
    if (yi > p[0] !== yj > p[0] && p[1] < ((xj - xi) * (p[0] - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

const num = (n: number, d = 0) => n.toLocaleString("es-CO", { maximumFractionDigits: d, minimumFractionDigits: d });

export function formatoDistancia(m: number): string {
  return m < 1000 ? `${num(m)} m` : `${num(m / 1000, 2)} km`;
}

export function formatoArea(m2: number): string {
  if (m2 < 10000) return `${num(m2)} m²`;
  if (m2 < 1_000_000) return `${num(m2 / 10000, 2)} ha`;
  return `${num(m2 / 1_000_000, 2)} km² (${num(m2 / 10000)} ha)`;
}
