export type TeselaMapa = { url: string; col: number; fila: number };
export type MapaEstaticoDatos = { teselas: TeselaMapa[]; columnas: number; filas: number; punto: { fx: number; fy: number } };

export const ATRIBUCION_MAPA = "© OpenStreetMap";

export function teselasMapa(lat: number, lon: number, zoom = 16, columnas = 3, filas = 2): MapaEstaticoDatos {
  const n = 2 ** zoom;
  const x = ((lon + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  const x0 = Math.floor(x - columnas / 2);
  const y0 = Math.floor(y - filas / 2);
  const teselas: TeselaMapa[] = [];
  for (let fila = 0; fila < filas; fila++) {
    for (let col = 0; col < columnas; col++) {
      const tx = (((x0 + col) % n) + n) % n;
      teselas.push({ url: `https://tile.openstreetmap.org/${zoom}/${tx}/${y0 + fila}.png`, col, fila });
    }
  }
  return { teselas, columnas, filas, punto: { fx: (x - x0) / columnas, fy: (y - y0) / filas } };
}
