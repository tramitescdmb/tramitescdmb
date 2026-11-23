import { bloquesCuerpo, type PersonaMemorando, type SegmentoTexto } from "@/lib/memorandos-formato";

/**
 * Metadatos de una firma electrónica, tal como salen en el recuadro del documento y en el PDF
 * (mismos datos de la ficha técnica de firmas, sin identificación personal ni IP).
 */
export type FirmaMemorandoDoc = {
  fecha: string;
  hash: string;
  sello: string | null;
  /** Identificador de la firma en el registro (código de verificación). */
  id?: string | null;
  nombre?: string | null;
  cargo?: string | null;
  /** «Firmante principal», «Proyectó», «Revisó». */
  calidad?: string | null;
  /** «Firma electrónica (hash SHA-256)», etc. */
  formato?: string | null;
};

export type DatosDocumentoMemorando = {
  numero: string | null;
  ciudad: string;
  fecha: string;
  para: PersonaMemorando | null;
  de: PersonaMemorando | null;
  asunto: string;
  cuerpo: string;
  proyecto: PersonaMemorando | null;
  reviso: PersonaMemorando | null;
  /** Estado de la firma de quien proyectó / revisó (p. ej. «Firmó electrónicamente el …» o «Pendiente de firma»). */
  estadoProyecto?: string | null;
  estadoReviso?: string | null;
  oficina: string;
  firma?: FirmaMemorandoDoc | null;
  firmaProyecto?: FirmaMemorandoDoc | null;
  firmaReviso?: FirmaMemorandoDoc | null;
  verificacion?: { radicado: string; url: string; radicadoEn?: string | null } | null;
};

const celda = "border border-stone-500 px-1.5 py-1 align-top";

function Texto({ segmentos }: { segmentos: SegmentoTexto[] }) {
  return (
    <>
      {segmentos.map((s, i) => (s.negrilla ? <b key={i}>{s.texto}</b> : <span key={i}>{s.texto}</span>))}
    </>
  );
}

function Cuerpo({ texto }: { texto: string }) {
  const bloques = bloquesCuerpo(texto);
  if (bloques.length === 0) return <p className="text-stone-400">Cuerpo del memorando…</p>;
  return (
    <div className="space-y-3 text-justify">
      {bloques.map((b, i) =>
        b.tipo === "parrafo" ? (
          <p key={i}>
            {b.lineas.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                <Texto segmentos={l} />
              </span>
            ))}
          </p>
        ) : (
          <table key={i} className="w-full border-collapse text-[11px]" data-pdf-bloque>
            <tbody>
              {b.filas.map((fila, j) => (
                <tr key={j} className={j === 0 ? "font-bold" : undefined}>
                  {fila.map((c, k) => (
                    <td key={k} className={`${celda} ${j === 0 ? "text-center" : ""}`}>
                      <Texto segmentos={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}

function Destinatario({ etiqueta, p, mayusculas }: { etiqueta: string; p: PersonaMemorando | null; mayusculas?: boolean }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-x-2">
      <span>{etiqueta}</span>
      <span>
        <b className="block">{p ? (mayusculas ? p.nombre.toUpperCase() : p.nombre) : "—"}</b>
        {p?.cargo && <span className="block">{p.cargo}</span>}
      </span>
    </div>
  );
}

/**
 * Memorando institucional con el formato del modelo ADEI – 054 /2026 (sin encabezado de logo ni nombre
 * de la entidad): número, ciudad y fecha, PARA / DE, asunto, cuerpo, firma con sus metadatos y cuadro de
 * responsables. Sirve para la vista previa del formulario y la ficha del memorando; el PDF se arma
 * aparte, con texto vectorial, a partir de los mismos datos (memorando-pdf.ts).
 */
export function DocumentoMemorando({ d, id }: { d: DatosDocumentoMemorando; id?: string }) {
  return (
    <article id={id} className="documento-memorando mx-auto max-w-[21.6cm] bg-white px-10 py-8 font-[Arial,Helvetica,sans-serif] text-[13px] leading-snug text-black print:px-0 print:py-0">
      <div className="space-y-5">
        <p className="text-center font-bold">MEMORANDO</p>

        <div className="space-y-3">
          <p>{d.numero ?? "____ – ___ /____"}</p>
          <p>
            {d.ciudad}, {d.fecha}
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <Destinatario etiqueta="PARA:" p={d.para} mayusculas />
          <Destinatario etiqueta="DE:" p={d.de} />
        </div>

        <div className="grid grid-cols-[5.5rem_1fr] gap-x-2 pt-2">
          <span>Asunto:</span>
          <b className="uppercase">{d.asunto || "—"}</b>
        </div>

        <Cuerpo texto={d.cuerpo} />

        <div className="break-inside-avoid pt-6" data-pdf-bloque>
          {d.firma ? (
            <RecuadroFirma f={d.firma} />
          ) : (
            <p className="mb-1 h-8 text-[10px] italic text-stone-400">(Firma electrónica al enviar)</p>
          )}
          <p className="font-bold uppercase">{d.de?.nombre ?? ""}</p>
          <p>{d.de?.cargo ?? ""}</p>
        </div>

        <table className="w-full table-fixed border-collapse text-[10px]" data-pdf-bloque>
          <tbody>
            {d.proyecto && <FilaResponsable etiqueta="Proyectó:" p={d.proyecto} firma={d.firmaProyecto} estado={d.estadoProyecto} />}
            {d.reviso && <FilaResponsable etiqueta="Revisó:" p={d.reviso} firma={d.firmaReviso} estado={d.estadoReviso} />}
            <tr>
              <td className={`${celda} w-[18%]`}>Oficina responsable:</td>
              <td className={celda} colSpan={3}>
                {d.oficina}
              </td>
            </tr>
          </tbody>
        </table>

        {d.verificacion && (
          <div className="break-inside-avoid border-t border-stone-300 pt-2 text-[9px] leading-snug text-stone-700" data-pdf-bloque>
            <p className="font-bold uppercase">Datos del documento</p>
            <p>
              Radicado <b className="font-mono">{d.verificacion.radicado}</b>
              {d.numero ? ` · Memorando ${d.numero}` : ""}
              {d.verificacion.radicadoEn ? ` · Radicado el ${d.verificacion.radicadoEn}` : ""}
              {` · ${[d.firma, d.firmaProyecto, d.firmaReviso].filter(Boolean).length} firma(s) electrónica(s)`}
            </p>
            <p className="mt-0.5">
              Documento firmado electrónicamente conforme al artículo 7 de la Ley 527 de 1999 y al Decreto 1074 de 2015. Verifique su autenticidad en{" "}
              <span className="break-all">{d.verificacion.url}</span> con el código de cada firma.
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

/** Recuadro de la firma de quien envía: firmante, calidad, fecha y hora, código y huella del contenido firmado. */
function RecuadroFirma({ f }: { f: FirmaMemorandoDoc }) {
  return (
    <div className="mb-2 max-w-[26rem] rounded border border-cdmb-600 px-2 py-1.5 text-[9px] leading-snug text-stone-800">
      <p className="text-[10px] font-bold uppercase text-cdmb-800">Firmado electrónicamente</p>
      {f.nombre && (
        <p>
          <span className="text-stone-500">Firmante:</span> {f.nombre}
          {f.cargo ? ` — ${f.cargo}` : ""}
          {f.calidad ? ` (${f.calidad})` : ""}
        </p>
      )}
      <p>
        <span className="text-stone-500">Fecha y hora:</span> {f.fecha} (hora de Colombia)
      </p>
      {f.id && (
        <p>
          <span className="text-stone-500">Código de la firma:</span> <span className="font-mono">{f.id}</span>
        </p>
      )}
      <p className="break-all">
        <span className="text-stone-500">Huella SHA-256:</span> <span className="font-mono">{f.hash}</span>
      </p>
      {(f.formato || f.sello) && (
        <p>
          {f.formato && (
            <>
              <span className="text-stone-500">Mecanismo:</span> {f.formato}
            </>
          )}
          {f.formato && f.sello ? " · " : ""}
          {f.sello && (
            <>
              <span className="text-stone-500">Sello de tiempo:</span> {f.sello}
            </>
          )}
        </p>
      )}
    </div>
  );
}

function FilaResponsable({ etiqueta, p, firma, estado }: { etiqueta: string; p: PersonaMemorando; firma?: FirmaMemorandoDoc | null; estado?: string | null }) {
  return (
    <tr>
      <td className={`${celda} w-[18%]`}>{etiqueta}</td>
      <td className={`${celda} w-[24%]`}>{p.nombre}</td>
      <td className={`${celda} w-[24%]`}>{p.cargo}</td>
      <td className={`${celda} text-[8.5px] leading-tight`}>
        {firma ? (
          <>
            <b className="block text-cdmb-800">Firmado electrónicamente</b>
            {firma.fecha}
            {firma.id && <span className="block break-all font-mono">Código: {firma.id}</span>}
            <span className="block break-all font-mono">SHA-256: {firma.hash.slice(0, 24)}…</span>
          </>
        ) : (
          <span className="italic text-stone-500">{estado ?? "Pendiente de firma"}</span>
        )}
      </td>
    </tr>
  );
}
