import { formatearFechaHoraLarga } from "@/lib/fecha";

const NAVEGADORES: [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\/(\d+)/, "Microsoft Edge"],
  [/OPR\/(\d+)/, "Opera"],
  [/Firefox\/(\d+)/, "Firefox"],
  [/CriOS\/(\d+)/, "Chrome"],
  [/Chrome\/(\d+)/, "Chrome"],
  [/Version\/(\d+)[\d.]* (?:Mobile\/\S+ )?Safari/, "Safari"],
];

const SISTEMAS: [RegExp, string][] = [
  [/Windows NT 10/, "Windows 10/11"],
  [/Windows NT/, "Windows"],
  [/Android/, "Android"],
  [/iPhone|iPad|iPod/, "iOS"],
  [/Mac OS X/, "macOS"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
];

export function navegadorLegible(userAgent: string | null | undefined): string | null {
  const ua = userAgent?.trim();
  if (!ua) return null;
  const navegador = NAVEGADORES.map(([re, nombre]) => ({ m: ua.match(re), nombre })).find((x) => x.m);
  const sistema = SISTEMAS.find(([re]) => re.test(ua))?.[1];
  if (!navegador && !sistema) return ua.slice(0, 120);
  const nombre = navegador ? `${navegador.nombre} ${navegador.m![1]}` : "Navegador no identificado";
  return sistema ? `${nombre} en ${sistema}` : nombre;
}

export function textoSelloTiempo(sello: { en: Date | null; fuente: string | null; token: string | null }): string | null {
  if (!sello.en) return null;
  const fecha = formatearFechaHoraLarga(sello.en);
  if (sello.token) return `${fecha} · RFC 3161${sello.fuente ? ` (${sello.fuente})` : ""}`;
  return fecha;
}
