import { enSmmlv, formatearSmmlv, smmlvDe } from "@/lib/smmlv";

export type TipoModificacion = "PRORROGA" | "ADICION_VALOR" | "PRORROGA_Y_ADICION" | "SUSPENSION" | "VIGENCIAS_FUTURAS" | "OTRA";

export type ClaseVigenciasFuturas = "ORDINARIA" | "EXCEPCIONAL";

export const CLASES_VIGENCIAS_FUTURAS: { valor: ClaseVigenciasFuturas; etiqueta: string; descripcion: string }[] = [
  { valor: "ORDINARIA", etiqueta: "Ordinaria", descripcion: "Con apropiación en la vigencia en curso de al menos el 15 % del valor." },
  { valor: "EXCEPCIONAL", etiqueta: "Excepcional", descripcion: "Sin apropiación en la vigencia en curso." },
];

export type VigenciaFutura = { anio: number; valor: number; desde: string; hasta: string };

export type PeriodoVigencia = { anio: number; desde: string; hasta: string };

export const TIPOS_MODIFICACION: { valor: TipoModificacion; etiqueta: string; descripcion: string; codigoFormato: string }[] = [
  { valor: "PRORROGA", etiqueta: "Prórroga del plazo", descripcion: "Amplía la fecha de terminación.", codigoFormato: "A-BS-FO123" },
  { valor: "ADICION_VALOR", etiqueta: "Adición en valor", descripcion: "Aumenta el valor del contrato.", codigoFormato: "A-BS-FO120" },
  { valor: "PRORROGA_Y_ADICION", etiqueta: "Prórroga y adición", descripcion: "Amplía el plazo y aumenta el valor.", codigoFormato: "A-BS-FO120" },
  { valor: "SUSPENSION", etiqueta: "Suspensión y reinicio", descripcion: "Detiene la ejecución; la terminación se corre los días suspendidos.", codigoFormato: "A-BS-FO130" },
  { valor: "VIGENCIAS_FUTURAS", etiqueta: "Vigencias futuras", descripcion: "Registra la autorización para comprometer recursos de la vigencia siguiente.", codigoFormato: "" },
  { valor: "OTRA", etiqueta: "Aclaración o modificación", descripcion: "Cambia otras condiciones, sin plazo ni valor.", codigoFormato: "A-BS-FO122" },
];

export const ETIQUETA_TIPO_MODIFICACION: Record<TipoModificacion, string> = {
  PRORROGA: "Prórroga",
  ADICION_VALOR: "Adición en valor",
  PRORROGA_Y_ADICION: "Prórroga y adición",
  SUSPENSION: "Suspensión",
  VIGENCIAS_FUTURAS: "Vigencias futuras",
  OTRA: "Aclaración o modificación",
};

export const LIMITE_ADICION = 0.5;

export type SoportePresupuestal = "CDP" | "RP";

export const SOPORTES_PRESUPUESTALES: { valor: SoportePresupuestal; sigla: string; nombre: string }[] = [
  { valor: "CDP", sigla: "CDP", nombre: "Certificado de disponibilidad presupuestal" },
  { valor: "RP", sigla: "RP", nombre: "Registro presupuestal" },
];

export function soportesRequeridos(m: { tipo: TipoModificacion; vigenciasFuturas: boolean }): SoportePresupuestal[] {
  const valor = cambiaValor(m.tipo);
  const futuras = m.tipo === "VIGENCIAS_FUTURAS" || m.vigenciasFuturas;
  return [...(valor ? (["CDP"] as const) : []), ...(valor || futuras ? (["RP"] as const) : [])];
}

export const MOTIVO_SIN_CDP = "Sin recursos nuevos de la vigencia en curso: el respaldo es el acto de autorización de vigencias futuras.";

const MS_DIA = 24 * 60 * 60 * 1000;

export function esDocumentoModificacion(nombre: string | null | undefined): boolean {
  if (/certificado|disponibilidad presupuestal|registro presupuestal|garant[ií]a|p[oó]liza/i.test(nombre ?? "")) return false;
  return /pr[oó]rroga|adici[oó]n(?![a-záéíóúñ])|modificatori|otro\s*s[ií](?![a-záéíóúñ])|modificaci[oó]n(?![a-záéíóúñ])|suspensi[oó]n/i.test(nombre ?? "");
}

export function cambiaPlazo(tipo: TipoModificacion): boolean {
  return tipo === "PRORROGA" || tipo === "PRORROGA_Y_ADICION";
}

export function cambiaValor(tipo: TipoModificacion): boolean {
  return tipo === "ADICION_VALOR" || tipo === "PRORROGA_Y_ADICION";
}

export type DatosModificacion = {
  tipo: TipoModificacion;
  fecha: string | null;
  fechaTerminacion: string | null;
  valorAdicionado: number | null;
  fechaSuspension: string | null;
  fechaReinicio: string | null;
  vigenciasFuturas: { clase: ClaseVigenciasFuturas | null; acto: string | null; hasta: string | null; valores: VigenciaFutura[] };
  observacion: string | null;
};

const fechaIso = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

export function leerModificacion(v: unknown): DatosModificacion | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Record<string, unknown>;
  const tipo = TIPOS_MODIFICACION.find((t) => t.valor === b.tipo)?.valor;
  if (!tipo) return null;
  const valor = Number(b.valorAdicionado);
  const observacion = typeof b.observacion === "string" ? b.observacion.trim().slice(0, 1000) : "";
  return {
    tipo,
    fecha: fechaIso(b.fecha),
    fechaTerminacion: cambiaPlazo(tipo) ? fechaIso(b.fechaTerminacion) : null,
    valorAdicionado: cambiaValor(tipo) && Number.isFinite(valor) && valor > 0 ? Math.round(valor) : null,
    fechaSuspension: tipo === "SUSPENSION" ? fechaIso(b.fechaSuspension) : null,
    fechaReinicio: tipo === "SUSPENSION" ? fechaIso(b.fechaReinicio) : null,
    vigenciasFuturas: leerVigenciasFuturas(b.vigenciasFuturas),
    observacion: observacion || null,
  };
}

function leerVigenciasFuturas(v: unknown): DatosModificacion["vigenciasFuturas"] {
  const b = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const clase = CLASES_VIGENCIAS_FUTURAS.find((c) => c.valor === b.clase)?.valor ?? null;
  const acto = typeof b.acto === "string" && b.acto.trim() ? b.acto.trim().slice(0, 300) : null;
  const valores = Array.isArray(b.valores)
    ? b.valores
        .map((x) => {
          const r = (x ?? {}) as Record<string, unknown>;
          const anio = Number(r.anio);
          const inicio = `${anio}-01-01`;
          const fin = `${anio}-12-31`;
          const desde = fechaIso(r.desde);
          const hasta = fechaIso(r.hasta);
          return {
            anio,
            valor: Math.round(Number(r.valor)),
            desde: desde && desde >= inicio && desde <= fin ? desde : inicio,
            hasta: hasta && hasta >= inicio && hasta <= fin ? hasta : fin,
          };
        })
        .filter((x) => Number.isInteger(x.anio) && x.anio > 2000 && Number.isFinite(x.valor) && x.valor > 0 && x.desde <= x.hasta)
    : [];
  return { clase, acto, hasta: fechaIso(b.hasta), valores };
}

export function tieneVigenciasFuturas(m: DatosModificacion): boolean {
  return Boolean(m.vigenciasFuturas.clase && m.vigenciasFuturas.acto && m.vigenciasFuturas.valores.length > 0);
}

export function diasSuspendidos(m: Pick<DatosModificacion, "fechaSuspension" | "fechaReinicio">): number {
  if (!m.fechaSuspension || !m.fechaReinicio) return 0;
  return Math.max(0, Math.round((utc(m.fechaReinicio).getTime() - utc(m.fechaSuspension).getTime()) / MS_DIA));
}

export function nuevaFechaTerminacion(m: DatosModificacion, actual: Date | null): Date | null {
  if (cambiaPlazo(m.tipo) && m.fechaTerminacion) return utc(m.fechaTerminacion);
  if (m.tipo === "SUSPENSION" && actual) {
    const dias = diasSuspendidos(m);
    return dias > 0 ? new Date(actual.getTime() + dias * MS_DIA) : null;
  }
  return null;
}

export function vigenciasComprometidas(actual: Date | null, nueva: Date | null): number[] {
  if (!actual || !nueva) return [];
  const anios: number[] = [];
  for (let a = actual.getUTCFullYear() + 1; a <= nueva.getUTCFullYear(); a++) anios.push(a);
  return anios;
}

export function periodosVigencias(anioBase: number, fin: Date | null): PeriodoVigencia[] {
  if (!fin) return [];
  const finIso = fin.toISOString().slice(0, 10);
  const periodos: PeriodoVigencia[] = [];
  for (let a = anioBase + 1; a <= fin.getUTCFullYear(); a++) {
    periodos.push({ anio: a, desde: `${a}-01-01`, hasta: a === fin.getUTCFullYear() ? finIso : `${a}-12-31` });
  }
  return periodos;
}

export function duracionPeriodo(desde: string, hasta: string): string {
  const inicio = utc(desde);
  const limite = new Date(utc(hasta).getTime() + MS_DIA);
  let meses = 0;
  while (true) {
    const siguiente = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + meses + 1, inicio.getUTCDate()));
    if (siguiente > limite) break;
    meses++;
  }
  const corte = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + meses, inicio.getUTCDate()));
  const dias = Math.round((limite.getTime() - corte.getTime()) / MS_DIA);
  const partes = [meses ? `${meses} ${meses === 1 ? "mes" : "meses"}` : "", dias ? `${dias} ${dias === 1 ? "día" : "días"}` : ""].filter(Boolean);
  return partes.join(" y ") || "0 días";
}

export function periodosRequeridos(m: DatosModificacion, terminacion: Date | null, hoy: Date = new Date()): PeriodoVigencia[] {
  if (m.tipo === "VIGENCIAS_FUTURAS") return periodosVigencias(hoy.getUTCFullYear(), m.vigenciasFuturas.hasta ? utc(m.vigenciasFuturas.hasta) : null);
  if (!terminacion) return [];
  return periodosVigencias(terminacion.getUTCFullYear(), nuevaFechaTerminacion(m, terminacion));
}

export function valoresConPeriodo(m: DatosModificacion, terminacion: Date | null, hoy: Date = new Date()): VigenciaFutura[] {
  const periodos = periodosRequeridos(m, terminacion, hoy);
  return m.vigenciasFuturas.valores.flatMap((v) => {
    const p = periodos.find((x) => x.anio === v.anio);
    return p ? [{ ...v, desde: p.desde, hasta: p.hasta }] : [];
  });
}

export function textoAnios(anios: number[]): string {
  return anios.length <= 1 ? String(anios[0] ?? "") : `${anios.slice(0, -1).join(", ")} y ${anios.at(-1)}`;
}

export type ContratoParaModificar = {
  terminacion: Date | null;
  inicio: Date | null;
  suscripcion: Date | null;
  valorInicial: number | null;
  tipoContrato: string;
  adiciones: { valor: number; fecha: Date }[];
  hoy?: Date;
};

export type LimiteAdicion = { inicialSm: number; adicionadoSm: number; disponibleSm: number; disponiblePesos: number; anioAdicion: number };

export function exentoLimiteAdicion(tipoContrato: string): boolean {
  return tipoContrato === "INTERVENTORIA";
}

export function limiteAdicion(contrato: ContratoParaModificar, fechaAdicion: Date): LimiteAdicion | null {
  if (exentoLimiteAdicion(contrato.tipoContrato) || !contrato.valorInicial) return null;
  const base = contrato.suscripcion ?? contrato.inicio ?? fechaAdicion;
  const inicialSm = enSmmlv(contrato.valorInicial, base);
  const adicionadoSm = contrato.adiciones.reduce((a, x) => a + enSmmlv(x.valor, x.fecha), 0);
  const disponibleSm = Math.max(0, inicialSm * LIMITE_ADICION - adicionadoSm);
  const anioAdicion = fechaAdicion.getUTCFullYear();
  return { inicialSm, adicionadoSm, disponibleSm, disponiblePesos: Math.floor(disponibleSm * smmlvDe(anioAdicion)), anioAdicion };
}

export function errorModificacion(m: DatosModificacion, contrato: ContratoParaModificar): string | null {
  const hoy = contrato.hoy ?? new Date();
  if (!m.fecha) return "Indique la fecha de suscripción de la modificación.";
  const fecha = utc(m.fecha);
  if (fecha.getTime() > hoy.getTime()) return "La fecha de suscripción no puede ser posterior a hoy.";
  if (!contrato.inicio) return "El contrato no tiene fecha de inicio: las modificaciones proceden una vez iniciada la ejecución.";
  if (fecha < contrato.inicio) return "La fecha de suscripción es anterior al inicio de la ejecución del contrato.";
  if (contrato.terminacion && fecha > contrato.terminacion) {
    return "El plazo del contrato ya había vencido en esa fecha: un contrato terminado no admite modificaciones.";
  }
  if (cambiaPlazo(m.tipo)) {
    if (!m.fechaTerminacion) return "Indique la nueva fecha de terminación.";
    if (contrato.terminacion && utc(m.fechaTerminacion) <= contrato.terminacion) return "La nueva fecha de terminación debe ser posterior a la actual.";
  }
  if (cambiaValor(m.tipo)) {
    if (!m.valorAdicionado) return "Indique el valor adicionado.";
    const limite = limiteAdicion(contrato, fecha);
    if (limite && enSmmlv(m.valorAdicionado, fecha) > limite.disponibleSm + 1e-9) {
      return `Las adiciones no pueden superar el 50 % del valor inicial expresado en SMMLV (${formatearSmmlv(limite.inicialSm * LIMITE_ADICION)}). Disponible: ${formatearSmmlv(limite.disponibleSm)}.`;
    }
  }
  if (m.tipo === "SUSPENSION") {
    if (!m.fechaSuspension || !m.fechaReinicio) return "Indique la fecha de suspensión y la de reinicio.";
    if (diasSuspendidos(m) <= 0) return "La fecha de reinicio debe ser posterior a la de suspensión.";
    if (utc(m.fechaSuspension) < contrato.inicio || (contrato.terminacion && utc(m.fechaSuspension) > contrato.terminacion)) {
      return "La suspensión debe empezar dentro del plazo de ejecución del contrato.";
    }
  }
  if (m.tipo === "OTRA" && !m.observacion) return "Describa brevemente la aclaración o modificación.";
  if (m.tipo === "VIGENCIAS_FUTURAS" && !m.vigenciasFuturas.hasta) return "Indique la fecha hasta la que se comprometen recursos de la vigencia siguiente.";
  const requeridos = periodosRequeridos(m, contrato.terminacion, contrato.hoy).map((p) => p.anio);
  if (m.tipo === "VIGENCIAS_FUTURAS" && requeridos.length === 0) return "La fecha debe pertenecer a una vigencia posterior a la actual.";
  if (requeridos.length > 0) {
    const prefijo = m.tipo === "VIGENCIAS_FUTURAS" ? "" : `La nueva terminación compromete la vigencia ${textoAnios(requeridos)}: `;
    if (!m.vigenciasFuturas.clase) return `${prefijo}indique si las vigencias futuras son ordinarias o excepcionales.`;
    if (!m.vigenciasFuturas.acto) return `${prefijo}indique el acto de autorización de vigencias futuras (número y fecha).`;
    const faltan = requeridos.filter((a) => !m.vigenciasFuturas.valores.some((v) => v.anio === a));
    if (faltan.length > 0) return `Indique el valor comprometido para ${textoAnios(faltan)}.`;
  }
  return null;
}
