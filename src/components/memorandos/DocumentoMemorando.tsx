import { bloquesCuerpo, type PersonaMemorando, type SegmentoTexto } from "@/lib/memorandos-formato";

export type FirmaMemorandoDoc = { fecha: string; hash: string; sello: string | null };

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
  oficina: string;
  firma?: FirmaMemorandoDoc | null;
  verificacion?: { radicado: string; url: string } | null;
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
 * Memorando institucional con el formato del modelo ADEI – 054 /2026: encabezado, número, ciudad y
 * fecha, PARA / DE, asunto, cuerpo, firma y cuadro de responsables. Sirve igual para la vista previa
 * del formulario, la ficha del memorando firmado y su descarga en PDF.
 */
export function DocumentoMemorando({ d, logoUrl, id }: { d: DatosDocumentoMemorando; logoUrl?: string | null; id?: string }) {
  return (
    <article id={id} className="documento-memorando mx-auto max-w-[21.6cm] bg-white px-10 py-8 font-[Arial,Helvetica,sans-serif] text-[13px] leading-snug text-black print:px-0 print:py-0">
      <div data-pdf-encabezado className="flex items-center gap-3 border-b border-stone-300 pb-2">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="CDMB" className="h-10 w-auto object-contain" />
        ) : (
          <span className="text-base font-bold text-cdmb-700">CDMB</span>
        )}
        <span className="text-[10px] uppercase leading-tight text-stone-600">
          Corporación Autónoma Regional para la Defensa
          <br />
          de la Meseta de Bucaramanga
        </span>
      </div>

      <div data-pdf-cuerpo className="space-y-5 pt-6">
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
            <p className="mb-1 inline-block rounded border border-cdmb-600 px-2 py-1 text-[10px] leading-tight text-cdmb-800">
              <b>Firmado electrónicamente</b> · {d.firma.fecha}
              <br />
              SHA-256 {d.firma.hash.slice(0, 16)}…{d.firma.sello ? ` · ${d.firma.sello}` : ""}
            </p>
          ) : (
            <p className="mb-1 h-8 text-[10px] italic text-stone-400">(Firma electrónica al enviar)</p>
          )}
          <p className="font-bold uppercase">{d.de?.nombre ?? ""}</p>
          <p>{d.de?.cargo ?? ""}</p>
        </div>

        <table className="w-full border-collapse text-[10px]" data-pdf-bloque>
          <tbody>
            {d.proyecto && (
              <tr>
                <td className={`${celda} w-[20%]`}>Proyectó:</td>
                <td className={`${celda} w-[30%]`}>{d.proyecto.nombre}</td>
                <td className={celda}>{d.proyecto.cargo}</td>
              </tr>
            )}
            {d.reviso && (
              <tr>
                <td className={`${celda} w-[20%]`}>Revisó:</td>
                <td className={`${celda} w-[30%]`}>{d.reviso.nombre}</td>
                <td className={celda}>{d.reviso.cargo}</td>
              </tr>
            )}
            <tr>
              <td className={`${celda} w-[20%]`}>Oficina responsable:</td>
              <td className={celda} colSpan={2}>
                {d.oficina}
              </td>
            </tr>
          </tbody>
        </table>

        {d.verificacion && (
          <p className="text-[9px] leading-snug text-stone-600">
            Documento firmado electrónicamente conforme al artículo 7 de la Ley 527 de 1999 y al Decreto 1074 de 2015. Radicado{" "}
            <b className="font-mono">{d.verificacion.radicado}</b>. Verifique su autenticidad en <span className="break-all">{d.verificacion.url}</span>.
          </p>
        )}
      </div>
    </article>
  );
}
