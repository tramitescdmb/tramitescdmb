import { extractText, getDocumentProxy } from "unpdf";

const MAX_CARACTERES = 20000;

export function recortarTextoPdf(texto: string, maxCaracteres: number = MAX_CARACTERES): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  return limpio.length > maxCaracteres ? limpio.slice(0, maxCaracteres) : limpio;
}

export async function extraerTextoPdf(bytes: Uint8Array | Buffer): Promise<string | null> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: true });
    const recortado = recortarTextoPdf(text);
    return recortado.length > 0 ? recortado : null;
  } catch {
    return null;
  }
}
