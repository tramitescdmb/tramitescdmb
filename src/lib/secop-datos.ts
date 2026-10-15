export const NIT_CDMB = "890201573";
const URL_CONTRATOS_SECOP = "https://www.datos.gov.co/resource/jbjy-vk9h.json";

type FilaSecop = Record<string, unknown>;

export type ContratoSecop = {
  numeroContrato: string | null;
  numeroProcesoSecop: string | null;
  idContrato: string | null;
  objeto: string | null;
  valor: number | null;
  fechaSuscripcion: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  modalidad: string;
  causal: string | null;
  tipoContrato: string;
  modalidadSecop: string;
  justificacionSecop: string;
  tipoSecop: string;
  estado: string | null;
  supervisor: string | null;
  supervisorDocumento: string | null;
  contratista: { tipoDocumento: string | null; documento: string | null; nombre: string | null };
  url: string | null;
};

const sinTildes = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const texto = (v: unknown) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s && !/^no definido$/i.test(s) ? s : null;
};

const fecha = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

export function modalidadDesdeSecop(modalidad: unknown, justificacion: unknown): string {
  const m = sinTildes(modalidad);
  const j = sinTildes(justificacion);
  if (m.includes("directa")) return "CONTRATACION_DIRECTA";
  if (m.includes("minima")) return "MINIMA_CUANTIA";
  if (m.includes("subasta inversa")) return "SELECCION_ABREVIADA_SUBASTA_INVERSA";
  if (m.includes("enajenacion")) return "SELECCION_ABREVIADA_ENAJENACION_BIENES";
  if (m.includes("acuerdo marco")) return "SELECCION_ABREVIADA_ACUERDO_MARCO";
  if (m.includes("bolsa")) return "SELECCION_ABREVIADA_BOLSA_PRODUCTOS";
  if (j.includes("desierto")) return "SELECCION_ABREVIADA_LICITACION_DESIERTA";
  if (m.includes("menor cuantia")) return "SELECCION_ABREVIADA_MENOR_CUANTIA";
  if (m.includes("concurso")) return "CONCURSO_MERITOS";
  if (m.includes("licitacion")) return "LICITACION_PUBLICA";
  if (m.includes("regimen especial") && j.includes("092")) return "CONVENIO_ASOCIACION";
  return "OTRA";
}

export function causalDesdeSecop(justificacion: unknown): string | null {
  const j = sinTildes(justificacion);
  if (j.includes("servicios profesionales")) return "SERVICIOS_PROFESIONALES_APOYO";
  if (j.includes("interadministrativ")) return "INTERADMINISTRATIVO";
  if (j.includes("urgencia")) return "URGENCIA_MANIFIESTA";
  if (j.includes("pluralidad")) return "NO_PLURALIDAD_OFERENTES";
  if (j.includes("cientific")) return "CIENCIA_TECNOLOGIA";
  if (j.includes("arrendamiento")) return "ARRENDAMIENTO_INMUEBLES";
  if (j.includes("adquisicion de inmuebles")) return "ADQUISICION_INMUEBLES";
  if (j.includes("prestamo de uso") || j.includes("comodato")) return "COMODATO";
  if (j.includes("emprestito")) return "EMPRESTITOS";
  if (j.includes("perito")) return "PERITOS";
  return null;
}

export function tipoDesdeSecop(tipo: unknown, causal: string | null): string {
  if (causal === "ADQUISICION_INMUEBLES") return "COMPRAVENTA";
  const t = sinTildes(tipo);
  if (t.includes("prestacion de servicios")) return "PRESTACION_SERVICIOS";
  if (t.includes("interventoria")) return "INTERVENTORIA";
  if (t.includes("consultoria")) return "CONSULTORIA";
  if (t.includes("obra")) return "OBRA";
  if (t.includes("suministro")) return "SUMINISTRO";
  if (t.includes("arrendamiento")) return "ARRENDAMIENTO";
  if (t.includes("compraventa") || t.includes("venta")) return "COMPRAVENTA";
  return "OTRO";
}

export function contratoDesdeFila(f: FilaSecop): ContratoSecop {
  const modalidad = modalidadDesdeSecop(f.modalidad_de_contratacion, f.justificacion_modalidad_de);
  const causal = modalidad === "CONTRATACION_DIRECTA" ? causalDesdeSecop(f.justificacion_modalidad_de) : null;
  const valor = Number(f.valor_del_contrato);
  const url = f.urlproceso && typeof f.urlproceso === "object" ? texto((f.urlproceso as { url?: unknown }).url) : null;
  return {
    numeroContrato: texto(f.referencia_del_contrato),
    numeroProcesoSecop: texto(f.proceso_de_compra),
    idContrato: texto(f.id_contrato),
    objeto: texto(f.objeto_del_contrato) ?? texto(f.descripcion_del_proceso),
    valor: Number.isFinite(valor) && valor > 0 ? Math.round(valor) : null,
    fechaSuscripcion: fecha(f.fecha_de_firma),
    fechaInicio: fecha(f.fecha_de_inicio_del_contrato),
    fechaFin: fecha(f.fecha_de_fin_del_contrato),
    modalidad,
    causal,
    tipoContrato: tipoDesdeSecop(f.tipo_de_contrato, causal),
    modalidadSecop: String(f.modalidad_de_contratacion ?? ""),
    justificacionSecop: String(f.justificacion_modalidad_de ?? ""),
    tipoSecop: String(f.tipo_de_contrato ?? ""),
    estado: texto(f.estado_contrato),
    supervisor: texto(f.nombre_supervisor),
    supervisorDocumento: texto(f.n_mero_de_documento_supervisor)?.replace(/\D/g, "") || null,
    contratista: { tipoDocumento: texto(f.tipodocproveedor), documento: texto(f.documento_proveedor), nombre: texto(f.proveedor_adjudicado) },
    url,
  };
}

export async function buscarContratosSecop(referencia: string): Promise<ContratoSecop[]> {
  const ref = referencia.trim().replace(/'/g, "");
  if (ref.length < 3) return [];
  const where = `nit_entidad='${NIT_CDMB}' AND (referencia_del_contrato='${ref}' OR id_contrato='${ref}' OR proceso_de_compra='${ref}')`;
  const url = `${URL_CONTRATOS_SECOP}?$where=${encodeURIComponent(where)}&$limit=5`;
  const token = process.env.SOCRATA_APP_TOKEN?.trim();
  const res = await fetch(url, { headers: token ? { "X-App-Token": token } : {}, cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error("SECOP II (datos.gov.co) no respondió. Intente de nuevo en unos minutos.");
  const filas = (await res.json()) as FilaSecop[];
  return filas.map(contratoDesdeFila);
}

const CONJUNTOS_RELACIONADOS = {
  facturas: { id: "ibyt-yi2f", columna: "id_contrato" },
  garantias: { id: "gjp9-cutm", columna: "id_contrato" },
  modificaciones: { id: "u8cx-r425", columna: "id_contrato" },
  adiciones: { id: "cb9c-h8sn", columna: "id_contrato" },
  suspensiones: { id: "u99c-7mfm", columna: "id_contrato" },
} as const;

export type ExpedienteSecop = {
  datos: Record<string, unknown>;
  facturas: Record<string, unknown>[];
  garantias: Record<string, unknown>[];
  modificaciones: Record<string, unknown>[];
  adiciones: Record<string, unknown>[];
  suspensiones: Record<string, unknown>[];
};

async function consultarSocrata(conjunto: string, where: string, limite = 200): Promise<Record<string, unknown>[]> {
  const url = `https://www.datos.gov.co/resource/${conjunto}.json?$where=${encodeURIComponent(where)}&$limit=${limite}`;
  const token = process.env.SOCRATA_APP_TOKEN?.trim();
  const res = await fetch(url, { headers: token ? { "X-App-Token": token } : {}, cache: "no-store", signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error("SECOP II (datos.gov.co) no respondió. Intente de nuevo en unos minutos.");
  return (await res.json()) as Record<string, unknown>[];
}

export async function consultarExpedienteSecop(idContrato: string): Promise<ExpedienteSecop | null> {
  const id = idContrato.trim().replace(/'/g, "");
  const [principal, ...relacionados] = await Promise.all([
    consultarSocrata("jbjy-vk9h", `nit_entidad='${NIT_CDMB}' AND id_contrato='${id}'`, 1),
    ...Object.values(CONJUNTOS_RELACIONADOS).map((c) => consultarSocrata(c.id, `${c.columna}='${id}'`, c.id === "u8cx-r425" ? 2000 : 200)),
  ]);
  if (!principal[0]) return null;
  const [facturas, garantias, modificaciones, adiciones, suspensiones] = relacionados;
  const { n_mero_de_cuenta: _cuenta, ...datos } = principal[0];
  void _cuenta;
  return { datos, facturas: facturas!, garantias: garantias!, modificaciones: consolidarModificaciones(modificaciones!), adiciones: adiciones!, suspensiones: suspensiones! };
}

export function consolidarModificaciones(filas: Record<string, unknown>[]): Record<string, unknown>[] {
  const ultima = new Map<string, Record<string, unknown>>();
  for (const f of filas) {
    const id = String(f.identificador_modificacion ?? f.identificador ?? "");
    const u = ultima.get(id);
    if (!u || Number(f.numero_version) > Number(u.numero_version)) ultima.set(id, f);
  }
  return [...ultima.values()];
}

export const fechaSecop = fecha;

export async function buscarContratosSecopPorContratista(documento: string, desde: Date, vigenteEn: Date): Promise<ContratoSecop[]> {
  const doc = documento.replace(/\D/g, "");
  if (doc.length < 5) return [];
  const dia = (d: Date) => `'${d.toISOString().slice(0, 10)}T00:00:00'`;
  const where = `nit_entidad='${NIT_CDMB}' AND documento_proveedor='${doc}' AND (fecha_de_firma >= ${dia(desde)} OR fecha_de_fin_del_contrato >= ${dia(vigenteEn)})`;
  const url = `${URL_CONTRATOS_SECOP}?$where=${encodeURIComponent(where)}&$order=fecha_de_firma DESC&$limit=10`;
  const token = process.env.SOCRATA_APP_TOKEN?.trim();
  const res = await fetch(url, { headers: token ? { "X-App-Token": token } : {}, cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error("SECOP II (datos.gov.co) no respondió. Intente de nuevo en unos minutos.");
  return ((await res.json()) as FilaSecop[]).map(contratoDesdeFila);
}
