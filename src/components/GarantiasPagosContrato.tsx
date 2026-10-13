"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ShieldCheck, Trash2, Wallet } from "lucide-react";
import { CampoMoneda } from "@/components/CampoMoneda";
import { AMPAROS_GARANTIA, ETIQUETA_AMPARO } from "@/lib/garantias-pagos";

export type GarantiaFila = {
  id: string;
  aseguradora: string;
  numeroPoliza: string;
  amparos: string[];
  valorAsegurado: number | null;
  vigenciaDesde: string | null;
  vigenciaHasta: string;
  aprobadaEn: string | null;
};

export type PagoFila = { id: string; numero: number; fecha: string; valor: number; periodoMes: string | null; observacion: string | null };

const pesos = (v: number) => `$ ${Math.round(v).toLocaleString("es-CO")}`;
const fecha = (iso: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
const campo = "rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500";
const hoyIso = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);

async function enviar(url: string, metodo: string, cuerpo?: unknown) {
  const res = await fetch(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "No se pudo completar la acción.");
}

export function GarantiasContrato({
  expedienteId,
  garantias,
  avisos,
  puedeRegistrar,
  puedeAprobar,
}: {
  expedienteId: string;
  garantias: GarantiaFila[];
  avisos: string[];
  puedeRegistrar: boolean;
  puedeAprobar: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [aseguradora, setAseguradora] = useState("");
  const [numeroPoliza, setNumeroPoliza] = useState("");
  const [amparos, setAmparos] = useState<string[]>(["CUMPLIMIENTO"]);
  const [valor, setValor] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function accion(fn: () => Promise<void>) {
    setOcupado(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setOcupado(false);
    }
  }

  const resumen =
    garantias.length === 0
      ? "Sin garantías registradas"
      : `${garantias.length} garantía(s) · vigente hasta ${fecha(garantias.map((g) => g.vigenciaHasta).sort().at(-1)!)}`;

  return (
    <details open={avisos.length > 0} className="group rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
          <ShieldCheck className="h-4 w-4 text-cdmb-600" aria-hidden />
          Garantías
          <span className="text-xs font-normal text-stone-500">{resumen}</span>
          {avisos.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-px text-[11px] font-medium text-amber-800">{avisos.length} aviso(s)</span>}
        </h2>
        <span className="text-xs text-stone-400 group-open:hidden">Ver</span>
      </summary>

      <div className="mt-3 space-y-3">
        {avisos.map((a) => (
          <p key={a} className="flex items-start gap-1.5 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
            <AlertTriangle className="mt-px h-3.5 w-3.5 flex-none text-amber-600" aria-hidden />
            {a}
          </p>
        ))}

        {garantias.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-stone-100">
            <table className="w-full text-xs">
              <thead className="bg-stone-50 text-left text-[11px] uppercase tracking-wide text-stone-400">
                <tr>
                  <th className="px-3 py-1.5 font-medium">Póliza</th>
                  <th className="px-3 py-1.5 font-medium">Amparos</th>
                  <th className="px-3 py-1.5 font-medium">Vigencia</th>
                  <th className="px-3 py-1.5 font-medium">Aprobación</th>
                  {puedeAprobar && <th className="px-3 py-1.5" aria-label="Acciones" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {garantias.map((g) => (
                  <tr key={g.id}>
                    <td className="px-3 py-1.5 text-stone-700">
                      <span className="font-medium">{g.numeroPoliza}</span>
                      <span className="block text-stone-400">
                        {g.aseguradora}
                        {g.valorAsegurado ? ` · ${pesos(g.valorAsegurado)}` : ""}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-stone-600">{g.amparos.map((a) => ETIQUETA_AMPARO[a] ?? a).join(", ")}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-stone-600">
                      {g.vigenciaDesde ? `${fecha(g.vigenciaDesde)} – ` : "Hasta "}
                      {fecha(g.vigenciaHasta)}
                    </td>
                    <td className="px-3 py-1.5">
                      {g.aprobadaEn ? (
                        <span className="rounded bg-emerald-50 px-1.5 py-px font-medium text-emerald-700">Aprobada {fecha(g.aprobadaEn)}</span>
                      ) : puedeAprobar ? (
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => accion(() => enviar(`/api/contratacion/expedientes/${expedienteId}/garantias/${g.id}`, "PATCH"))}
                          className="rounded bg-cdmb-600 px-2 py-px font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
                        >
                          Aprobar
                        </button>
                      ) : (
                        <span className="rounded bg-amber-50 px-1.5 py-px font-medium text-amber-700">Por aprobar</span>
                      )}
                    </td>
                    {puedeAprobar && (
                      <td className="px-3 py-1.5 text-right">
                        <button
                          type="button"
                          title="Eliminar garantía"
                          disabled={ocupado}
                          onClick={() => confirm(`¿Eliminar la garantía ${g.numeroPoliza}?`) && accion(() => enviar(`/api/contratacion/expedientes/${expedienteId}/garantias/${g.id}`, "DELETE"))}
                          className="text-stone-400 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {puedeRegistrar &&
          (abierto ? (
            <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50/60 p-3">
              <div className="flex flex-wrap gap-3">
                <label className="flex flex-col gap-1 text-xs text-stone-600">
                  Aseguradora o entidad
                  <input value={aseguradora} onChange={(e) => setAseguradora(e.target.value)} className={`${campo} w-56`} />
                </label>
                <label className="flex flex-col gap-1 text-xs text-stone-600">
                  N.° de póliza
                  <input value={numeroPoliza} onChange={(e) => setNumeroPoliza(e.target.value)} className={`${campo} w-40`} />
                </label>
                <label className="flex flex-col gap-1 text-xs text-stone-600">
                  Valor asegurado (opcional)
                  <CampoMoneda value={valor} onChange={setValor} className="w-40" />
                </label>
                <label className="flex flex-col gap-1 text-xs text-stone-600">
                  Vigente desde
                  <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={campo} />
                </label>
                <label className="flex flex-col gap-1 text-xs text-stone-600">
                  Vigente hasta
                  <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={campo} />
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {AMPAROS_GARANTIA.map((a) => {
                  const activo = amparos.includes(a.valor);
                  return (
                    <button
                      key={a.valor}
                      type="button"
                      onClick={() => setAmparos((x) => (activo ? x.filter((v) => v !== a.valor) : [...x, a.valor]))}
                      className={`rounded-full border px-2.5 py-0.5 font-medium ${activo ? "border-cdmb-600 bg-cdmb-600 text-white" : "border-stone-200 bg-white text-stone-700"}`}
                    >
                      {a.etiqueta}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() =>
                    accion(async () => {
                      await enviar(`/api/contratacion/expedientes/${expedienteId}/garantias`, "POST", {
                        aseguradora,
                        numeroPoliza,
                        amparos,
                        valorAsegurado: valor ? Number(valor) : null,
                        vigenciaDesde: desde || null,
                        vigenciaHasta: hasta,
                      });
                      setAbierto(false);
                      setAseguradora("");
                      setNumeroPoliza("");
                      setValor("");
                      setDesde("");
                      setHasta("");
                    })
                  }
                  className="rounded-lg bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
                >
                  Registrar garantía
                </button>
                <button type="button" onClick={() => setAbierto(false)} className="text-xs text-stone-500 hover:text-stone-800">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setAbierto(true)} className="text-xs font-medium text-cdmb-700 hover:underline">
              + Registrar garantía o ampliación
            </button>
          ))}
        {error && <p className="text-xs text-red-700">{error}</p>}
      </div>
    </details>
  );
}

export function PagosContrato({
  expedienteId,
  pagos,
  valorTotal,
  pagado,
  saldo,
  porcentajePagado,
  porcentajePlazo,
  periodos,
  puedeRegistrar,
  puedeEliminar,
}: {
  expedienteId: string;
  pagos: PagoFila[];
  valorTotal: number | null;
  pagado: number;
  saldo: number | null;
  porcentajePagado: number | null;
  porcentajePlazo: number | null;
  periodos: { clave: string; etiqueta: string }[];
  puedeRegistrar: boolean;
  puedeEliminar: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [fechaPago, setFechaPago] = useState(hoyIso);
  const [valor, setValor] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [observacion, setObservacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function accion(fn: () => Promise<void>) {
    setOcupado(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setOcupado(false);
    }
  }

  const rezago = porcentajePagado !== null && porcentajePlazo !== null && porcentajePlazo - porcentajePagado >= 25;

  return (
    <details className="group rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
        <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-stone-900">
          <Wallet className="h-4 w-4 text-cdmb-600" aria-hidden />
          Pagos
          <span className="text-xs font-normal text-stone-500">
            {pesos(pagado)} pagado{valorTotal !== null && ` de ${pesos(valorTotal)}`}
            {porcentajePagado !== null && ` · ejecución financiera ${porcentajePagado} %`}
            {porcentajePlazo !== null && ` · plazo ${porcentajePlazo} %`}
          </span>
          {rezago && <span className="rounded-full bg-amber-100 px-2 py-px text-[11px] font-medium text-amber-800">Pagos rezagados frente al plazo</span>}
        </h2>
        <span className="text-xs text-stone-400 group-open:hidden">Ver</span>
      </summary>

      <div className="mt-3 space-y-3">
        {valorTotal !== null && (
          <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, porcentajePagado ?? 0)}%` }} />
          </div>
        )}
        {saldo !== null && <p className="text-xs text-stone-600">Saldo por pagar: <strong className="text-stone-900">{pesos(saldo)}</strong></p>}

        {pagos.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-stone-100">
            <table className="w-full text-xs">
              <thead className="bg-stone-50 text-left text-[11px] uppercase tracking-wide text-stone-400">
                <tr>
                  <th className="px-3 py-1.5 font-medium">N.°</th>
                  <th className="px-3 py-1.5 font-medium">Fecha</th>
                  <th className="px-3 py-1.5 font-medium">Periodo</th>
                  <th className="px-3 py-1.5 font-medium">Valor</th>
                  <th className="px-3 py-1.5 font-medium">Observación</th>
                  {puedeEliminar && <th className="px-3 py-1.5" aria-label="Acciones" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {pagos.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-1.5 font-medium text-stone-800">{p.numero}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-stone-600">{fecha(p.fecha)}</td>
                    <td className="px-3 py-1.5 text-stone-600">{periodos.find((x) => x.clave === p.periodoMes)?.etiqueta ?? p.periodoMes ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-stone-800">{pesos(p.valor)}</td>
                    <td className="px-3 py-1.5 text-stone-500">{p.observacion ?? "—"}</td>
                    {puedeEliminar && (
                      <td className="px-3 py-1.5 text-right">
                        <button
                          type="button"
                          title="Eliminar pago"
                          disabled={ocupado}
                          onClick={() => confirm(`¿Eliminar el pago N.° ${p.numero}?`) && accion(() => enviar(`/api/contratacion/expedientes/${expedienteId}/pagos/${p.id}`, "DELETE"))}
                          className="text-stone-400 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {puedeRegistrar &&
          (abierto ? (
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-stone-200 bg-stone-50/60 p-3">
              <label className="flex flex-col gap-1 text-xs text-stone-600">
                Fecha del pago
                <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} className={campo} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-stone-600">
                Valor
                <CampoMoneda value={valor} onChange={setValor} className="w-40" />
              </label>
              {periodos.length > 0 && (
                <label className="flex flex-col gap-1 text-xs text-stone-600">
                  Periodo
                  <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className={campo}>
                    <option value="">Sin periodo</option>
                    {periodos.map((p) => (
                      <option key={p.clave} value={p.clave}>
                        {p.etiqueta}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs text-stone-600">
                Observación (opcional)
                <input value={observacion} onChange={(e) => setObservacion(e.target.value)} placeholder="Ej. orden de pago N.° 1234" className={campo} />
              </label>
              <button
                type="button"
                disabled={ocupado}
                onClick={() =>
                  accion(async () => {
                    await enviar(`/api/contratacion/expedientes/${expedienteId}/pagos`, "POST", {
                      fecha: fechaPago,
                      valor: Number(valor),
                      periodoMes: periodo || null,
                      observacion,
                    });
                    setAbierto(false);
                    setValor("");
                    setPeriodo("");
                    setObservacion("");
                  })
                }
                className="rounded-lg bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
              >
                Registrar pago
              </button>
              <button type="button" onClick={() => setAbierto(false)} className="pb-1.5 text-xs text-stone-500 hover:text-stone-800">
                Cancelar
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setAbierto(true)} className="text-xs font-medium text-cdmb-700 hover:underline">
              + Registrar pago
            </button>
          ))}
        {error && <p className="text-xs text-red-700">{error}</p>}
      </div>
    </details>
  );
}
