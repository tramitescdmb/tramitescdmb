"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightCircle, CheckCircle2, XCircle, RotateCcw } from "lucide-react";

/** Una entrada del catálogo: un trámite, o uno de sus procedimientos cuando el catálogo los muestra por separado. */
export type TramiteOpcion = { clave: string; href: string; nombre: string; codigo: string; enSuit: boolean; radicable: boolean };

/** Los nombres largos desbordan la lista desplegable: se acortan y el nombre completo queda en el título. */
const MAX_NOMBRE = 70;
const acortar = (texto: string) => (texto.length > MAX_NOMBRE ? `${texto.slice(0, MAX_NOMBRE - 1).trimEnd()}…` : texto);

/**
 * Los mismos grupos y conteos del catálogo (sus mismas entradas): primero los inscritos en el SUIT y luego los demás,
 * en orden alfabético. Los instrumentos económicos (IE-) no se muestran. Los trámites sin
 * procedimiento en SIC aparecen, pero no se pueden elegir: se gestionan en VITAL.
 */
function gruposTramites(tramites: TramiteOpcion[]) {
  const lista = tramites.filter((t) => !t.codigo.startsWith("IE-"));
  return [
    { titulo: "Trámites inscritos en el SUIT", lista: lista.filter((t) => t.enSuit) },
    { titulo: "Sin registro en el SUIT", lista: lista.filter((t) => !t.enSuit) },
  ];
}

export function GestionSolicitudVital({
  solicitudId,
  gestion,
  expediente,
  motivoDescarte,
  gestionadaTexto,
  tramites,
  claveSugerida,
}: {
  solicitudId: string;
  gestion: "NUEVA" | "CONVERTIDA" | "DESCARTADA" | null;
  expediente: { id: string; numero: string } | null;
  motivoDescarte: string | null;
  gestionadaTexto: string | null;
  /** Trámites que el usuario puede radicar; vacío = solo consulta. */
  tramites: TramiteOpcion[];
  claveSugerida: string | null;
}) {
  const router = useRouter();
  const [clave, setClave] = useState(claveSugerida ?? "");
  const elegido = tramites.find((t) => t.clave === clave && t.radicable) ?? null;
  const [descartando, setDescartando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(accion: "descartar" | "reabrir") {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/vital/${solicitudId}/gestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion, motivo }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "No se pudo guardar.");
      }
      setDescartando(false);
      setMotivo("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setEnviando(false);
    }
  }

  if (expediente) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm text-emerald-800">
        <CheckCircle2 className="h-4 w-4 flex-none text-emerald-600" aria-hidden />
        Convertida en trámite: expediente{" "}
        <Link href={`/expedientes/${expediente.id}`} className="font-semibold text-cdmb-700 hover:underline">
          {expediente.numero}
        </Link>
        {gestionadaTexto && <span className="text-xs text-stone-500">({gestionadaTexto})</span>}
      </p>
    );
  }

  const puede = tramites.length > 0;

  if (gestion === "DESCARTADA") {
    return (
      <div className="space-y-2 text-sm">
        <p className="flex items-center gap-2 text-stone-700">
          <XCircle className="h-4 w-4 flex-none text-stone-400" aria-hidden />
          No se convirtió en trámite{gestionadaTexto ? ` (${gestionadaTexto})` : ""}.
        </p>
        {motivoDescarte && <p className="rounded-md bg-stone-50 px-3 py-2 text-stone-600">Motivo: {motivoDescarte}</p>}
        {puede && (
          <button
            type="button"
            disabled={enviando}
            onClick={() => enviar("reabrir")}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-60"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Volver a marcarla como nueva
          </button>
        )}
        {error && <p className="text-xs text-red-700">{error}</p>}
      </div>
    );
  }

  if (!puede) {
    return <p className="text-sm text-stone-500">Aún no se ha convertido en trámite. Lo hacen el administrador o el Subdirector(a) de Evaluación y Control Ambiental.</p>;
  }

  return (
    <div className="space-y-3">
      {gestion === "NUEVA" && (
        <p className="inline-flex items-center rounded-sm bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">Nueva: pendiente de convertir en trámite</p>
      )}
      <div className="flex min-w-0 flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 basis-64">
          <span className="mb-1 block text-xs font-medium text-stone-600">Trámite ambiental en el que se gestiona</span>
          <select
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            title={elegido?.nombre}
            className="block w-full min-w-0 max-w-full truncate rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Seleccione el trámite…</option>
            {gruposTramites(tramites)
              .filter((g) => g.lista.length > 0)
              .map((g) => (
                <optgroup key={g.titulo} label={`${g.titulo} (${g.lista.length})`}>
                  {g.lista.map((t) => (
                    <option key={t.clave} value={t.clave} disabled={!t.radicable} title={t.nombre}>
                      {acortar(t.nombre)} ({t.codigo}){t.clave === claveSugerida ? " — sugerido" : ""}
                      {!t.radicable ? " — se gestiona en VITAL" : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
          </select>
        </label>
        {elegido ? (
          <Link
            href={`${elegido.href}${elegido.href.includes("?") ? "&" : "?"}vital=${solicitudId}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-4 py-2 text-sm font-medium text-white hover:bg-acento-600"
          >
            <ArrowRightCircle className="h-4 w-4" aria-hidden />
            Convertir en trámite
          </Link>
        ) : (
          <span className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md bg-stone-200 px-4 py-2 text-sm font-medium text-stone-500">
            <ArrowRightCircle className="h-4 w-4" aria-hidden />
            Convertir en trámite
          </span>
        )}
      </div>

      {descartando ? (
        <div className="space-y-2 rounded-md border border-stone-200 p-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-stone-600">¿Por qué no da lugar a un trámite?</span>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              maxLength={1000}
              className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm"
              placeholder="Por ejemplo: es un reporte de contingencia, ya existe el expediente…"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={enviando || !motivo.trim()}
              onClick={() => enviar("descartar")}
              className="rounded-md bg-stone-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-60"
            >
              No convertir
            </button>
            <button type="button" onClick={() => setDescartando(false)} className="rounded-md px-3 py-1.5 text-xs text-stone-500 hover:text-stone-700">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setDescartando(true)} className="text-xs font-medium text-stone-500 hover:text-stone-700 hover:underline">
          Esta solicitud no da lugar a un trámite
        </button>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
