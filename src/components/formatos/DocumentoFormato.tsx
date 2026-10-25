import {
  aDms,
  cumplimientoFila,
  filasConDatos,
  formatearNumero,
  formatearValorCampo,
  resolverPlantilla,
  resumenAgrupado,
  totalColumna,
  valorColumnaFila,
  type Campo,
  type DatosPrecarga,
  type EstructuraFormato,
  type Respuestas,
  type ValorChequeo,
  type ValorCoordenadas,
} from "@/lib/formato-visita";
import { desdeLatLon, planasOrigenBogota } from "@/lib/coordenadas";

export type EncabezadoFormato = {
  codigo: string;
  titulo: string;
  versionDocumento: string;
  fechaDocumento: string | null;
  logoUrl?: string | null;
};

const celda = "border border-stone-400 px-2 py-1 align-top";
const etiquetaCls = `${celda} w-[42%] bg-stone-50 text-[11px] font-bold uppercase text-stone-800`;

export function DocumentoFormato({
  encabezado,
  estructura,
  respuestas,
  precarga,
  fotos = [],
  enBlanco = false,
  numeroConcepto = null,
}: {
  encabezado: EncabezadoFormato;
  estructura: EstructuraFormato;
  respuestas: Respuestas;
  precarga: DatosPrecarga;
  fotos?: { id: string; url: string; pie?: string }[];
  enBlanco?: boolean;
  numeroConcepto?: string | null;
}) {
  return (
    <article className="documento-formato mx-auto max-w-[21cm] bg-white text-[12px] leading-snug text-stone-900">
      <table className="w-full border-collapse">
        <thead className="table-header-group">
          <tr>
            <td className="pb-3">
              <Encabezado e={encabezado} />
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="space-y-4">
              <p className="text-center text-sm font-bold uppercase">Concepto técnico No. {numeroConcepto ?? "________ de ____________"}</p>
              {estructura.secciones.map((s) => (
                <section key={s.id} className="break-inside-avoid-page">
                  <h3 className="mb-1 border border-stone-400 bg-stone-100 px-2 py-1 text-center text-[12px] font-bold uppercase">{s.titulo}</h3>
                  <BloquesSeccion campos={s.campos} estructura={estructura} respuestas={respuestas} precarga={precarga} enBlanco={enBlanco} />
                </section>
              ))}

              {fotos.length > 0 && (
                <section>
                  <h3 className="mb-1 border border-stone-400 bg-stone-100 px-2 py-1 text-center text-[12px] font-bold uppercase">Registro fotográfico</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {fotos.map((f, i) => (
                      <figure key={f.id} className="break-inside-avoid border border-stone-300 p-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.url} alt={`Fotografía ${i + 1}`} className="mx-auto max-h-[9cm] w-auto object-contain" />
                        <figcaption className="mt-1 text-center text-[10px] italic text-stone-600">{f.pie ?? `Fotografía ${i + 1}`}</figcaption>
                      </figure>
                    ))}
                  </div>
                </section>
              )}

              <section className="break-inside-avoid space-y-3 pt-2">
                <BloqueFirma titulo="Nombre y firma del responsable" nombre={precarga.funcionario ?? ""} />
                <BloqueFirma titulo="Nombre y firma revisó aspectos jurídicos" />
                <BloqueFirma titulo="Nombre y firma revisó aspectos técnicos" />
                <BloqueFirma titulo="Visto bueno de la coordinación respectiva" oficina />
              </section>
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}

function Encabezado({ e }: { e: EncabezadoFormato }) {
  return (
    <table className="w-full border-collapse text-[10px]">
      <tbody>
        <tr>
          <td className={`${celda} w-[26%] text-center`} colSpan={2}>
            {e.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.logoUrl} alt="CDMB" className="mx-auto h-10 w-auto object-contain" />
            ) : (
              <span className="text-base font-bold text-cdmb-700">CDMB</span>
            )}
          </td>
          <td className={`${celda} text-center text-[11px] font-bold`} colSpan={3}>
            CORPORACIÓN AUTÓNOMA REGIONAL PARA LA DEFENSA DE LA MESETA DE BUCARAMANGA-CDMB
          </td>
        </tr>
        <tr>
          <td className={celda}>
            <b>CÓDIGO:</b>
            <br />
            {e.codigo}
          </td>
          <td className={celda}>
            <b>VERSIÓN:</b>
            <br />
            {e.versionDocumento}
          </td>
          <td className={celda}>
            <b>ELABORÓ:</b>
            <br />
            Profesional Evaluación y Control Ambiental
          </td>
          <td className={celda}>
            <b>REVISÓ:</b>
            <br />
            Delegado de la Dirección
          </td>
          <td className={celda}>
            <b>APROBÓ:</b>
            <br />
            Dirección General
          </td>
        </tr>
        <tr>
          <td className={celda} colSpan={2}>
            <b>FECHA:</b>
            <br />
            {e.fechaDocumento || "—"}
          </td>
          <td className={`${celda} text-center text-[12px] font-bold`} colSpan={3}>
            {e.titulo}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function esSimple(c: Campo): boolean {
  return ["texto", "numero", "fecha", "seleccion", "si_no", "calculado"].includes(c.tipo);
}

function BloquesSeccion({
  campos,
  estructura,
  respuestas,
  precarga,
  enBlanco,
}: {
  campos: Campo[];
  estructura: EstructuraFormato;
  respuestas: Respuestas;
  precarga: DatosPrecarga;
  enBlanco: boolean;
}) {
  const bloques: Campo[][] = [];
  for (const c of campos) {
    const ultimo = bloques[bloques.length - 1];
    if (esSimple(c) && ultimo && esSimple(ultimo[0]!)) ultimo.push(c);
    else bloques.push([c]);
  }
  return (
    <div className="space-y-2">
      {bloques.map((b) =>
        esSimple(b[0]!) ? (
          <table key={b[0]!.id} className="w-full border-collapse">
            <tbody>
              {b.map((c) => (
                <tr key={c.id}>
                  <td className={etiquetaCls}>{c.etiqueta}:</td>
                  <td className={celda}>{enBlanco ? "" : formatearValorCampo(estructura, respuestas, c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <BloqueComplejo key={b[0]!.id} campo={b[0]!} estructura={estructura} respuestas={respuestas} precarga={precarga} enBlanco={enBlanco} />
        )
      )}
    </div>
  );
}

function BloqueComplejo({
  campo,
  estructura,
  respuestas,
  precarga,
  enBlanco,
}: {
  campo: Campo;
  estructura: EstructuraFormato;
  respuestas: Respuestas;
  precarga: DatosPrecarga;
  enBlanco: boolean;
}) {
  const v = respuestas[campo.id];
  if (campo.tipo === "parrafo") {
    const texto = typeof v === "string" ? v : "";
    return (
      <div className="border border-stone-400">
        <p className="border-b border-stone-400 bg-stone-50 px-2 py-1 text-[11px] font-bold uppercase">{campo.etiqueta}</p>
        <p className="min-h-8 whitespace-pre-line px-2 py-1.5 text-justify">{enBlanco ? (campo.plantilla ? <span className="text-stone-400">{campo.plantilla}</span> : "") : texto}</p>
      </div>
    );
  }
  if (campo.tipo === "coordenadas") {
    const c = (v as ValorCoordenadas | undefined) ?? { lat: null, lon: null };
    const listo = !enBlanco && c.lat != null && c.lon != null;
    const nac = listo ? desdeLatLon(c.lat!, c.lon!) : null;
    const bog = listo ? planasOrigenBogota(c.lat!, c.lon!) : null;
    return (
      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <td className={etiquetaCls} rowSpan={campo.conCota ? 4 : 3}>
              {campo.etiqueta}
            </td>
            <td className={`${celda} text-center text-[10px] font-bold`}>NORTE (origen Bogotá)</td>
            <td className={`${celda} text-center text-[10px] font-bold`}>ESTE (origen Bogotá)</td>
          </tr>
          <tr>
            <td className={`${celda} text-center`}>{bog ? formatearNumero(bog.norte, 0) : ""}</td>
            <td className={`${celda} text-center`}>{bog ? formatearNumero(bog.este, 0) : ""}</td>
          </tr>
          <tr>
            <td className={`${celda} text-center`}>
              <span className="text-[10px] font-bold">LATITUD </span>
              {listo ? aDms(c.lat!, true) : ""}
            </td>
            <td className={`${celda} text-center`}>
              <span className="text-[10px] font-bold">LONGITUD </span>
              {listo ? aDms(c.lon!, false) : ""}
            </td>
          </tr>
          {campo.conCota && (
            <tr>
              <td className={`${celda} text-center`} colSpan={2}>
                <span className="text-[10px] font-bold">COTA </span>
                {listo && c.cota ? `${c.cota} m s. n. m.` : ""}
                {nac && <span className="ml-3 text-[10px] text-stone-500">Origen nacional: N {formatearNumero(nac.planaY, 0)} · E {formatearNumero(nac.planaX, 0)}</span>}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    );
  }
  if (campo.tipo === "lista_chequeo") {
    const val = (v as ValorChequeo | undefined) ?? { marcados: [] };
    const items = enBlanco ? (campo.items ?? []).map((_, i) => i) : val.marcados;
    return (
      <div className="border border-stone-400">
        <p className="border-b border-stone-400 bg-stone-50 px-2 py-1 text-[11px] font-bold uppercase">{campo.etiqueta}</p>
        <ol className="list-decimal space-y-1 py-1.5 pl-7 pr-2 text-justify">
          {items.map((i) => (
            <li key={i}>{resolverPlantilla(campo.items?.[i]?.texto ?? "", estructura, enBlanco ? {} : respuestas, enBlanco ? {} : precarga)}</li>
          ))}
          {!enBlanco && val.adicional?.trim() && <li className="whitespace-pre-line">{val.adicional}</li>}
        </ol>
      </div>
    );
  }
  if (campo.tipo === "tabla") {
    const cols = campo.columnas ?? [];
    const filas = enBlanco ? [] : filasConDatos(campo, v);
    const conTotal = cols.some((c) => c.total);
    const grupos = enBlanco ? [] : resumenAgrupado(campo, v);
    return (
      <div className="space-y-2">
        <table className="w-full border-collapse text-[10px]">
          <caption className="pb-1 text-[11px] font-bold">{campo.etiqueta}</caption>
          <thead>
            <tr className="bg-stone-100">
              <th className={celda}>No.</th>
              {cols.map((c) => (
                <th key={c.id} className={celda}>
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(filas.length ? filas : [{}, {}]).map((f, i) => (
              <tr key={i} className="break-inside-avoid">
                <td className={`${celda} text-center`}>{filas.length ? i + 1 : ""}</td>
                {cols.map((c) => (
                  <td key={c.id} className={`${celda} ${c.tipo === "texto" ? "" : "text-center"}`}>
                    {!filas.length
                      ? ""
                      : c.tipo === "calculado"
                        ? formatearNumero(valorColumnaFila(campo, f, c.id), c.decimales ?? 2)
                        : c.tipo === "cumplimiento"
                          ? (cumplimientoFila(campo, f, c) ?? "")
                          : c.tipo === "numero" && c.decimales != null
                            ? formatearNumero(valorColumnaFila(campo, f, c.id), c.decimales) || (f[c.id] ?? "")
                            : (f[c.id] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {conTotal && filas.length > 0 && (
            <tfoot>
              <tr className="bg-stone-50 font-bold">
                <td className={celda} />
                {cols.map((c, idx) => (
                  <td key={c.id} className={`${celda} text-center`}>
                    {c.total ? formatearNumero(totalColumna(campo, filas, c.id), c.decimales ?? 2) : idx === 0 ? "TOTAL" : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
        {campo.agrupar && grupos.length > 0 && (
          <table className="w-full border-collapse text-[10px]">
            <caption className="pb-1 text-[11px] font-bold">{campo.agrupar.titulo ?? `${campo.etiqueta} — resumen`}</caption>
            <thead>
              <tr className="bg-stone-100">
                {campo.agrupar.por.map((k) => (
                  <th key={k} className={celda}>
                    {cols.find((c) => c.id === k)?.titulo}
                  </th>
                ))}
                <th className={celda}>No. indiv.</th>
                {campo.agrupar.sumar.map((k) => (
                  <th key={k} className={celda}>
                    {cols.find((c) => c.id === k)?.titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grupos.map((g, i) => (
                <tr key={i}>
                  {g.claves.map((k, j) => (
                    <td key={j} className={celda}>
                      {k}
                    </td>
                  ))}
                  <td className={`${celda} text-center`}>{g.conteo}</td>
                  {g.sumas.map((s, j) => (
                    <td key={j} className={`${celda} text-center`}>
                      {formatearNumero(s, cols.find((c) => c.id === campo.agrupar!.sumar[j])?.decimales ?? 2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }
  return null;
}

function BloqueFirma({ titulo, nombre = "", oficina = false }: { titulo: string; nombre?: string; oficina?: boolean }) {
  return (
    <div className="break-inside-avoid">
      <p className="text-[11px] italic">{titulo}:</p>
      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <td className={`${celda} w-[30%] font-bold italic`}>Nombre:</td>
            <td className={celda}>{nombre}</td>
          </tr>
          <tr>
            <td className={`${celda} font-bold italic`}>Cargo:</td>
            <td className={celda} />
          </tr>
          <tr>
            <td className={`${celda} h-9 font-bold italic`}>Firma:</td>
            <td className={celda} />
          </tr>
          {oficina && (
            <tr>
              <td className={`${celda} font-bold italic`}>Oficina responsable:</td>
              <td className={celda}>Subdirección de Evaluación y Control Ambiental - SEYCA</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
