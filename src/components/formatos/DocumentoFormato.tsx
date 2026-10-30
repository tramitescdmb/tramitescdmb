import {
  aDms,
  campoAplica,
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
import { MapaEstatico } from "@/components/formatos/MapaEstatico";

export type FotoDocumento = { id: string; url: string; pie?: string };
export type FirmaElectronicaFila = { estado: "FIRMADO" | "VISTO_BUENO" | "PENDIENTE" | "RECHAZADO"; fecha?: string | null };
export type FirmanteDocumento = { titulo: string; nombre: string; cargo: string; usuarioId?: string; firma?: FirmaElectronicaFila | null };
export type VerificacionDocumento = { csv: string; url: string };

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
  firmantes,
  verificacion = null,
}: {
  encabezado: EncabezadoFormato;
  estructura: EstructuraFormato;
  respuestas: Respuestas;
  precarga: DatosPrecarga;
  fotos?: FotoDocumento[];
  enBlanco?: boolean;
  numeroConcepto?: string | null;
  firmantes?: FirmanteDocumento[];
  verificacion?: VerificacionDocumento | null;
}) {
  const fotosEnCampo = estructura.secciones.some((s) => s.campos.some((c) => c.tipo === "fotos"));
  return (
    <article className="documento-formato mx-auto max-w-[21cm] bg-white text-[12px] leading-snug text-stone-900">
      <table className="w-full border-collapse">
        <thead className="table-header-group">
          <tr>
            <td className="pb-3" data-pdf-encabezado>
              <Encabezado e={encabezado} />
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="space-y-4" data-pdf-cuerpo>
              <p className="text-center text-sm font-bold uppercase">Concepto técnico No. {numeroConcepto ?? "________ de ____________"}</p>
              {estructura.secciones.map((s) => (
                <section key={s.id} className="break-inside-avoid-page">
                  <h3 className="mb-1 border border-stone-400 bg-stone-100 px-2 py-1 text-center text-[12px] font-bold uppercase">{s.titulo}</h3>
                  <BloquesSeccion campos={enBlanco ? s.campos : s.campos.filter((c) => campoAplica(c, precarga))} estructura={estructura} respuestas={respuestas} precarga={precarga} enBlanco={enBlanco} fotos={fotos} />
                </section>
              ))}

              {!fotosEnCampo && fotos.length > 0 && (
                <section>
                  <h3 className="mb-1 border border-stone-400 bg-stone-100 px-2 py-1 text-center text-[12px] font-bold uppercase">Registro fotográfico</h3>
                  <RegistroFotografico fotos={fotos} />
                </section>
              )}

              <section className="break-inside-avoid space-y-3 pt-2">
                <TablaResponsables
                  filas={
                    firmantes && firmantes.length > 0
                      ? firmantes
                      : [
                          { titulo: "Elaboró", nombre: precarga.funcionario ?? "", cargo: "" },
                          { titulo: "Revisó aspectos técnicos", nombre: "", cargo: "" },
                          { titulo: "Revisó aspectos jurídicos", nombre: "", cargo: "" },
                          { titulo: "Visto bueno de la coordinación", nombre: "", cargo: "" },
                        ]
                  }
                />
                {verificacion && (
                  <p className="border border-stone-400 px-2 py-1.5 text-[10px] leading-snug text-stone-700">
                    Documento firmado electrónicamente conforme al artículo 7 de la Ley 527 de 1999 y al Decreto 1074 de 2015. Código seguro de verificación (CSV):{" "}
                    <b className="font-mono text-cdmb-800">{verificacion.csv}</b>. Verifique su autenticidad en <span className="break-all">{verificacion.url}</span>.
                  </p>
                )}
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

function RegistroFotografico({ fotos }: { fotos: FotoDocumento[] }) {
  const pares: FotoDocumento[][] = [];
  for (let i = 0; i < fotos.length; i += 2) pares.push(fotos.slice(i, i + 2));
  return (
    <div className="space-y-2">
      {pares.map((par, k) => (
        <div key={k} className="grid grid-cols-2 gap-2" data-pdf-bloque>
          {par.map((f, j) => {
            const n = k * 2 + j + 1;
            return (
              <figure key={f.id} className="break-inside-avoid border border-stone-300 p-1 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={`Fotografía ${n}`} className="mx-auto max-h-[9cm] w-auto object-contain" />
                <figcaption className="mt-1 text-center text-[10px] italic text-stone-600">
                  <b>Fotografía {n}.</b> {f.pie}
                </figcaption>
              </figure>
            );
          })}
        </div>
      ))}
    </div>
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
  fotos,
}: {
  campos: Campo[];
  estructura: EstructuraFormato;
  respuestas: Respuestas;
  precarga: DatosPrecarga;
  enBlanco: boolean;
  fotos: FotoDocumento[];
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
          <BloqueComplejo key={b[0]!.id} campo={b[0]!} estructura={estructura} respuestas={respuestas} precarga={precarga} enBlanco={enBlanco} fotos={fotos} />
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
  fotos,
}: {
  campo: Campo;
  estructura: EstructuraFormato;
  respuestas: Respuestas;
  precarga: DatosPrecarga;
  enBlanco: boolean;
  fotos: FotoDocumento[];
}) {
  const v = respuestas[campo.id];
  if (campo.tipo === "fotos") {
    return (
      <div>
        <p className="mb-1 text-[11px] font-bold uppercase">{campo.etiqueta}</p>
        {fotos.length > 0 ? <RegistroFotografico fotos={fotos} /> : <p className="border border-stone-400 px-2 py-3 text-center text-[10px] text-stone-500">{enBlanco ? "Fotografías de la visita con su pie de foto" : "Sin fotografías"}</p>}
      </div>
    );
  }
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
      <div className="space-y-1">
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
      {listo && <MapaEstatico lat={c.lat!} lon={c.lon!} pie={`Localización del punto: ${aDms(c.lat!, true)} · ${aDms(c.lon!, false)}`} className="mx-auto w-[60%]" />}
      </div>
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

function TextoFirma({ firma }: { firma: FirmaElectronicaFila | null | undefined }) {
  if (!firma) return <span className="text-stone-400">—</span>;
  if (firma.estado === "FIRMADO" || firma.estado === "VISTO_BUENO") {
    return (
      <span className="text-[11px] font-semibold text-cdmb-800">
        {firma.estado === "VISTO_BUENO" ? "Visto bueno electrónico" : "Firmado electrónicamente"}
        {firma.fecha && <span className="block font-normal text-stone-600">{firma.fecha}</span>}
      </span>
    );
  }
  if (firma.estado === "RECHAZADO") return <span className="text-[11px] font-semibold text-red-700">Rechazó la firma</span>;
  return <span className="text-[11px] text-amber-800">Pendiente de firma</span>;
}

function TablaResponsables({ filas }: { filas: FirmanteDocumento[] }) {
  const conFirma = filas.some((f) => f.firma);
  return (
    <table className="w-full border-collapse" data-pdf-bloque>
      <thead>
        <tr className="bg-stone-100 text-[11px] uppercase">
          <th className={`${celda} w-[30%] text-left`}>Responsabilidad</th>
          <th className={`${celda} text-left`}>Nombre</th>
          <th className={`${celda} text-left`}>Cargo</th>
          {conFirma && <th className={`${celda} w-[22%] text-left`}>Firma electrónica</th>}
        </tr>
      </thead>
      <tbody>
        {filas.map((f, i) => (
          <tr key={i}>
            <td className={`${celda} font-bold italic`}>{f.titulo}</td>
            <td className={celda}>{f.nombre}</td>
            <td className={celda}>{f.cargo}</td>
            {conFirma && (
              <td className={celda}>
                <TextoFirma firma={f.firma} />
              </td>
            )}
          </tr>
        ))}
        <tr>
          <td className={`${celda} font-bold italic`}>Oficina responsable</td>
          <td className={celda} colSpan={conFirma ? 3 : 2}>
            Subdirección de Evaluación y Control Ambiental - SEYCA
          </td>
        </tr>
      </tbody>
    </table>
  );
}
