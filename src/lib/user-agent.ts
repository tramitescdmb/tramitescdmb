/**
 * Interpretación mínima del User-Agent para la bitácora (MoReq 6.7: registrar
 * navegador y dispositivo). Puro y sin dependencias — no pretende ser exhaustivo,
 * solo poner en palabras lo que ya se guarda como cadena cruda.
 */

export type OrigenUA = { navegador: string; dispositivo: string };

export function interpretarUserAgent(ua: string | null | undefined): OrigenUA {
  if (!ua) return { navegador: "—", dispositivo: "—" };
  const u = ua.toLowerCase();

  let navegador = "Otro";
  if (u.includes("edg/")) navegador = "Edge";
  else if (u.includes("opr/") || u.includes("opera")) navegador = "Opera";
  else if (u.includes("firefox/")) navegador = "Firefox";
  else if (u.includes("chrome/") && !u.includes("chromium")) navegador = "Chrome";
  else if (u.includes("chromium/")) navegador = "Chromium";
  else if (u.includes("safari/") && u.includes("version/")) navegador = "Safari";

  let so = "";
  if (u.includes("windows nt")) so = "Windows";
  else if (u.includes("android")) so = "Android";
  else if (u.includes("iphone") || u.includes("ipad") || u.includes("ipod")) so = "iOS";
  else if (u.includes("mac os x") || u.includes("macintosh")) so = "macOS";
  else if (u.includes("linux")) so = "Linux";

  const esMovil = /mobile|iphone|ipod|android(?!.*tablet)/.test(u) && !u.includes("ipad");
  const esTablet = u.includes("ipad") || (u.includes("android") && !u.includes("mobile"));
  const tipo = esTablet ? "Tableta" : esMovil ? "Móvil" : "Escritorio";

  return { navegador, dispositivo: so ? `${tipo} · ${so}` : tipo };
}
