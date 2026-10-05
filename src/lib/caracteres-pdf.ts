const EXTRA_WINANSI = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

const REEMPLAZOS: Record<string, string> = {
  "→": "->",
  "←": "<-",
  "≥": ">=",
  "≤": "<=",
  "≠": "!=",
  "✓": "v",
  "✔": "v",
  " ": " ",
  " ": " ",
  " ": " ",
  "​": "",
  "\t": " ",
};

function esWinAnsi(ch: string): boolean {
  const c = ch.codePointAt(0)!;
  return (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || EXTRA_WINANSI.has(ch);
}

export function limpiarCadenasPdf<T>(valor: T): T {
  if (typeof valor === "string") return textoPdf(valor) as T;
  if (Array.isArray(valor)) return valor.map(limpiarCadenasPdf) as T;
  if (valor && typeof valor === "object" && Object.getPrototypeOf(valor) === Object.prototype) {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, limpiarCadenasPdf(v)])) as T;
  }
  return valor;
}

export function textoPdf(texto: string | null | undefined): string {
  if (!texto) return "";
  let salida = "";
  for (const ch of texto.normalize("NFC")) {
    if (ch === "\n" || esWinAnsi(ch)) {
      salida += ch;
      continue;
    }
    if (ch in REEMPLAZOS) {
      salida += REEMPLAZOS[ch];
      continue;
    }
    const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
    salida += base && [...base].every(esWinAnsi) ? base : "?";
  }
  return salida;
}
