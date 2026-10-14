import { ExternalLink, Landmark } from "lucide-react";
import { BotonSincronizarSecop } from "@/components/BotonSincronizarSecop";
import { consolidarModificaciones } from "@/lib/secop-datos";

type Fila = Record<string, unknown>;
type Formato = "texto" | "pesos" | "fecha";

const GRUPOS: { titulo: string; campos: [string, string, Formato?][] }[] = [
  {
    titulo: "Contrato",
    campos: [
      ["objeto_del_contrato", "Objeto"],
      ["descripcion_del_proceso", "Descripción del proceso"],
      ["id_contrato", "ID del contrato"],
      ["referencia_del_contrato", "N.° de contrato"],
      ["proceso_de_compra", "Proceso"],
      ["estado_contrato", "Estado"],
      ["modalidad_de_contratacion", "Modalidad"],
      ["justificacion_modalidad_de", "Justificación"],
      ["tipo_de_contrato", "Tipo"],
      ["codigo_de_categoria_principal", "Categoría UNSPSC"],
      ["duraci_n_del_contrato", "Duración"],
      ["el_contrato_puede_ser_prorrogado", "Prorrogable"],
      ["dias_adicionados", "Días adicionados"],
      ["liquidaci_n", "Liquidación"],
      ["fecha_de_firma", "Firma", "fecha"],
      ["fecha_de_inicio_del_contrato", "Inicio", "fecha"],
      ["fecha_de_fin_del_contrato", "Terminación", "fecha"],
      ["fecha_inicio_liquidacion", "Inicio de liquidación", "fecha"],
      ["fecha_fin_liquidacion", "Fin de liquidación", "fecha"],
      ["ultima_actualizacion", "Última actualización en SECOP", "fecha"],
      ["condiciones_de_entrega", "Condiciones de entrega"],
      ["habilita_pago_adelantado", "Habilita pago adelantado"],
      ["puntos_del_acuerdo", "Puntos del Acuerdo de Paz"],
      ["pilares_del_acuerdo", "Pilares del Acuerdo de Paz"],
      ["documentos_tipo", "Documentos tipo"],
    ],
  },
  {
    titulo: "Valores",
    campos: [
      ["valor_del_contrato", "Valor del contrato", "pesos"],
      ["valor_de_pago_adelantado", "Pago adelantado", "pesos"],
      ["valor_facturado", "Facturado", "pesos"],
      ["valor_pagado", "Pagado", "pesos"],
      ["valor_pendiente_de_pago", "Pendiente de pago", "pesos"],
      ["valor_amortizado", "Amortizado", "pesos"],
      ["valor_pendiente_de", "Pendiente de amortizar", "pesos"],
      ["valor_pendiente_de_ejecucion", "Pendiente de ejecución", "pesos"],
      ["saldo_cdp", "Saldo CDP", "pesos"],
      ["saldo_vigencia", "Saldo de la vigencia", "pesos"],
    ],
  },
  {
    titulo: "Recursos",
    campos: [
      ["origen_de_los_recursos", "Origen"],
      ["destino_gasto", "Destino del gasto"],
      ["codigo_bpin", "Código BPIN"],
      ["presupuesto_general_de_la_nacion_pgn", "Presupuesto General de la Nación", "pesos"],
      ["sistema_general_de_participaciones", "Sistema General de Participaciones", "pesos"],
      ["sistema_general_de_regal_as", "Sistema General de Regalías", "pesos"],
      ["recursos_propios", "Recursos propios", "pesos"],
      ["recursos_propios_alcald_as_gobernaciones_y_resguardos_ind_genas_", "Recursos propios territoriales", "pesos"],
      ["recursos_de_credito", "Recursos de crédito", "pesos"],
    ],
  },
  {
    titulo: "Personas",
    campos: [
      ["proveedor_adjudicado", "Contratista"],
      ["tipodocproveedor", "Tipo de documento"],
      ["documento_proveedor", "Documento del contratista"],
      ["codigo_proveedor", "Código del proveedor en SECOP"],
      ["es_pyme", "Es mipyme"],
      ["es_grupo", "Es consorcio o unión temporal"],
      ["nombre_representante_legal", "Representante legal"],
      ["tipo_de_identificaci_n_representante_legal", "Tipo de documento del representante"],
      ["identificaci_n_representante_legal", "Documento del representante"],
      ["nacionalidad_representante_legal", "Nacionalidad del representante"],
      ["domicilio_representante_legal", "Domicilio del representante"],
      ["g_nero_representante_legal", "Género del representante"],
      ["nombre_supervisor", "Supervisor"],
      ["tipo_de_documento_supervisor", "Tipo de documento del supervisor"],
      ["n_mero_de_documento_supervisor", "Documento del supervisor"],
      ["nombre_ordenador_del_gasto", "Ordenador del gasto"],
      ["tipo_de_documento_ordenador_del_gasto", "Tipo de documento del ordenador"],
      ["n_mero_de_documento_ordenador_del_gasto", "Documento del ordenador"],
      ["nombre_ordenador_de_pago", "Ordenador del pago"],
      ["tipo_de_documento_ordenador_de_pago", "Tipo de documento del ordenador del pago"],
      ["n_mero_de_documento_ordenador_de_pago", "Documento del ordenador del pago"],
    ],
  },
  {
    titulo: "Entidad",
    campos: [
      ["nombre_entidad", "Entidad"],
      ["nit_entidad", "NIT"],
      ["codigo_entidad", "Código en SECOP"],
      ["orden", "Orden"],
      ["rama", "Rama"],
      ["entidad_centralizada", "Centralizada"],
      ["departamento", "Departamento"],
      ["ciudad", "Ciudad"],
      ["localizaci_n", "Localización"],
    ],
  },
  {
    titulo: "Otros",
    campos: [
      ["sector", "Sector"],
      ["obligaci_n_ambiental", "Obligación ambiental"],
      ["obligaciones_postconsumo", "Obligaciones posconsumo"],
      ["reversion", "Reversión"],
      ["espostconflicto", "Posconflicto"],
      ["nombre_del_banco", "Banco del contratista"],
      ["tipo_de_cuenta", "Tipo de cuenta"],
    ],
  },
];

const OCULTOS = new Set(["n_mero_de_cuenta", "urlproceso"]);
const CONOCIDOS = new Set(GRUPOS.flatMap((g) => g.campos.map(([c]) => c)));

function etiquetaDe(clave: string): string {
  const t = clave.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const vacio = (v: unknown) => v === null || v === undefined || v === "" || /^(no definido|sin descripcion)$/i.test(String(v));

function valor(v: unknown, formato: Formato = "texto"): string {
  if (formato === "pesos") {
    const n = Number(v);
    return Number.isFinite(n) ? `$ ${Math.round(n).toLocaleString("es-CO")}` : String(v);
  }
  if (formato === "fecha") {
    const s = String(v).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s)
      ? new Date(`${s}T12:00:00Z`).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
      : String(v);
  }
  return typeof v === "boolean" ? (v ? "Sí" : "No") : String(v);
}

function Tabla({ titulo, filas, columnas }: { titulo: string; filas: Fila[]; columnas: [string, string, Formato?][] }) {
  if (filas.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
        {titulo} ({filas.length})
      </p>
      <div className="overflow-x-auto rounded-lg border border-stone-100">
        <table className="w-full text-xs">
          <thead className="bg-stone-50/70 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-400">
            <tr>
              {columnas.map(([, etiqueta]) => (
                <th key={etiqueta} className="px-3 py-1.5">
                  {etiqueta}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filas.map((f, i) => (
              <tr key={i}>
                {columnas.map(([clave, etiqueta, formato]) => (
                  <td key={etiqueta} className="px-3 py-1.5 text-stone-700">
                    {vacio(f[clave]) ? "—" : valor(f[clave], formato)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function porFecha(filas: Fila[], clave: string): Fila[] {
  return [...filas].sort((a, b) => String(a[clave] ?? "").localeCompare(String(b[clave] ?? "")));
}

export function SecopPanel({
  expedienteId,
  espejo,
  puedeSincronizar,
}: {
  expedienteId: string;
  espejo: { idContrato: string; datos: Fila; facturas: Fila[]; garantias: Fila[]; modificaciones: Fila[]; adiciones: Fila[]; suspensiones: Fila[]; sincronizadoEn: Date } | null;
  puedeSincronizar: boolean;
}) {
  const d = espejo?.datos ?? {};
  const url = d.urlproceso && typeof d.urlproceso === "object" ? String((d.urlproceso as { url?: unknown }).url ?? "") : "";

  return (
    <details className="group rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
        <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-stone-900">
          <Landmark className="h-4 w-4 text-cdmb-600" aria-hidden />
          SECOP II
          {espejo ? (
            <span className="text-xs font-normal text-stone-500">
              {String(d.estado_contrato ?? "")} · {valor(d.valor_del_contrato, "pesos")} · pagado {valor(d.valor_pagado ?? 0, "pesos")} · sincronizado{" "}
              {espejo.sincronizadoEn.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" })}
            </span>
          ) : (
            <span className="text-xs font-normal text-stone-500">Sin enlazar</span>
          )}
        </h2>
        <span className="flex items-center gap-3">
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-cdmb-700 hover:underline">
              Ver en SECOP II <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
          {puedeSincronizar && <BotonSincronizarSecop expedienteId={expedienteId} enlazado={Boolean(espejo)} />}
        </span>
      </summary>

      <div className="mt-3 space-y-4">
        <p className="text-[11px] text-stone-500">
          Datos de solo lectura tomados de la API de datos abiertos de SECOP II (datos.gov.co), que se actualizan cada día. SECOP II es la
          fuente oficial: el número de contrato y de proceso, el objeto, la modalidad, el tipo, el valor, las fechas y el contratista del
          expediente se toman de aquí. Los documentos se consultan en SECOP II; GECON no los copia.
        </p>
        {!espejo && (
          <p className="text-xs text-stone-600">
            Este expediente aún no está enlazado. Con el número de contrato o de proceso en los datos generales, «Enlazar con SECOP II» lo
            busca entre los contratos de la CDMB.
          </p>
        )}
        {espejo &&
          [
            ...GRUPOS,
            {
              titulo: "Otros campos publicados",
              campos: Object.keys(d)
                .filter((k) => !CONOCIDOS.has(k) && !OCULTOS.has(k) && typeof d[k] !== "object")
                .map((k): [string, string, Formato?] => [k, etiquetaDe(k)]),
            },
          ].map((g) => {
            const campos = g.campos.filter(([clave]) => !vacio(d[clave]));
            if (campos.length === 0) return null;
            return (
              <div key={g.titulo}>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">{g.titulo}</p>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
                  {campos.map(([clave, etiqueta, formato]) => (
                    <div key={clave} className={`flex gap-1.5 ${String(d[clave]).length > 70 ? "sm:col-span-2 lg:col-span-3" : ""}`}>
                      <dt className="flex-none text-stone-500">{etiqueta}:</dt>
                      <dd className="min-w-0 break-words font-medium text-stone-800">{valor(d[clave], formato)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        {espejo && (
          <>
            <Tabla
              titulo="Facturas"
              filas={porFecha(espejo.facturas, "fecha_factura")}
              columnas={[
                ["id_pago", "Pago N.°"],
                ["numero_de_factura", "Factura"],
                ["fecha_factura", "Fecha", "fecha"],
                ["valor_total", "Valor", "pesos"],
                ["estado", "Estado"],
                ["fecha_estiamda_de_pago", "Pago estimado", "fecha"],
              ]}
            />
            <Tabla
              titulo="Modificaciones"
              filas={porFecha(consolidarModificaciones(espejo.modificaciones), "fecha_de_aprobacion")}
              columnas={[
                ["fecha_de_aprobacion", "Aprobación", "fecha"],
                ["proposito_modificacion", "Propósito"],
                ["dias_extendidos", "Días extendidos"],
                ["valor_modificacion", "Valor del contrato reportado", "pesos"],
                ["estado_modificacion", "Estado"],
              ]}
            />
            <Tabla
              titulo="Adiciones"
              filas={porFecha(espejo.adiciones, "fecharegistro")}
              columnas={[
                ["fecharegistro", "Registro", "fecha"],
                ["tipo", "Tipo"],
                ["descripcion", "Descripción"],
              ]}
            />
            <Tabla
              titulo="Suspensiones"
              filas={porFecha(espejo.suspensiones, "fecha_de_aprobacion")}
              columnas={[
                ["tipo", "Tipo"],
                ["fecha_de_aprobacion", "Aprobación", "fecha"],
                ["proposito_de_la_modificacion", "Propósito"],
              ]}
            />
            <Tabla
              titulo="Garantías"
              filas={espejo.garantias}
              columnas={[
                ["tipopoliza", "Tipo"],
                ["subtipopoliza", "Amparo"],
                ["aseguradora", "Aseguradora"],
                ["numeropoliza", "Póliza"],
                ["valor", "Valor", "pesos"],
                ["fechafinpoliza", "Vigente hasta", "fecha"],
                ["estado", "Estado"],
              ]}
            />
          </>
        )}
      </div>
    </details>
  );
}
