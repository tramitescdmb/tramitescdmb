/**
 * Separa el campo «Correo» de un negocio que trae dos correos (herencia de la plataforma anterior,
 * p. ej. «a@x.com, b@y.com» o «a@x.com / b@y.com»): el primero queda como correo y el segundo pasa a
 * «Correo secundario». Es puro (sin base) para poder probarlo; lo usa
 * scripts/negocios-verdes-correo-secundario.ts.
 */
import { problemaCorreo } from "@/lib/negocios-verdes-verificacion";

export type PropuestaCorreos =
  | { accion: "separar"; email: string; emailSecundario: string | null; avisos: string[] }
  | { accion: "omitir"; motivo: string };

/** Palabras que pueden ir entre los dos correos sin que se pierda nada al separarlos. */
const CONECTORES = new Set(["y", "o", "e", "-", "–", "—", "&", "+"]);

/** Quita «mailto:» y signos pegados al principio o al final («(a@x.com)», «a@x.com.»). */
function limpiar(trozo: string): string {
  return trozo.replace(/^mailto:/i, "").replace(/^[("'<\[{.:]+/, "").replace(/[)"'>\]}.:]+$/, "");
}

/** Propone cómo repartir `email` entre correo y correo secundario, o explica por qué no se toca. */
export function proponerSeparacion(email: string | null, emailSecundario: string | null): PropuestaCorreos {
  const texto = (email ?? "").trim();
  if ((texto.match(/@/g) ?? []).length < 2) return { accion: "omitir", motivo: "No tiene dos correos." };

  const trozos = texto.split(/[\s,;/|\\]+/).map(limpiar).filter(Boolean);
  const correos = trozos.filter((t) => t.includes("@"));
  const otros = trozos.filter((t) => !t.includes("@") && !CONECTORES.has(t.toLowerCase()));
  if (correos.some((c) => (c.match(/@/g) ?? []).length !== 1)) return { accion: "omitir", motivo: "Los correos están pegados o tienen más de una @: hay que separarlos a mano." };
  if (correos.length > 2) return { accion: "omitir", motivo: `Tiene ${correos.length} correos y solo hay un campo secundario: hay que elegir a mano.` };
  if (otros.length) return { accion: "omitir", motivo: `Además de los correos tiene texto («${otros.join(" ")}») que se perdería: hay que revisarlo a mano.` };

  const [primero, segundo] = correos as [string, string];
  const actual = (emailSecundario ?? "").trim();
  // Los dos correos son el mismo: queda uno y el secundario no se toca.
  if (primero.toLowerCase() === segundo.toLowerCase()) return { accion: "separar", email: primero, emailSecundario: actual || null, avisos: avisos(primero, null) };
  if (actual && actual.toLowerCase() !== segundo.toLowerCase()) return { accion: "omitir", motivo: `Ya tiene otro correo secundario («${actual}»): hay que elegir a mano.` };
  const secundario = actual || segundo;
  return { accion: "separar", email: primero, emailSecundario: secundario, avisos: avisos(primero, secundario) };
}

/** Problemas que siguen después de separar (se mueven igual; «Revisión de datos» los seguirá señalando). */
function avisos(email: string, secundario: string | null): string[] {
  const lista: string[] = [];
  const p1 = problemaCorreo(email);
  if (p1) lista.push(`Correo «${email}»: ${p1}`);
  const p2 = problemaCorreo(secundario);
  if (p2) lista.push(`Correo secundario «${secundario}»: ${p2}`);
  return lista;
}
