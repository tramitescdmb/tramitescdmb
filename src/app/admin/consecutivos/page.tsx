import Link from "next/link";
import { redirect } from "next/navigation";
import { Hash } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { CabeceraTablero } from "@/components/tablero";
import { ETIQUETA_MODULO_CONSECUTIVO, listarConsecutivos, listarSiglasTramite, type ModuloConsecutivo } from "@/lib/consecutivos";
import { partesColombia } from "@/lib/planeador";

const MODULOS: ModuloConsecutivo[] = ["TRAMITES", "PLANEADOR", "GECON", "SGDEA", "MEMORANDOS"];

export default async function ConsecutivosPage({ searchParams }: { searchParams: Promise<{ anio?: string; ok?: string; error?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") return <AccesoRestringido titulo="Consecutivos" quien="administrador del sistema" volverHref="/" volverLabel="Ir al inicio" />;

  const sp = await searchParams;
  const actual = Number(partesColombia(new Date()).fecha.slice(0, 4));
  const pedido = Number(sp.anio);
  const anio = Number.isInteger(pedido) && pedido >= actual - 1 && pedido <= actual + 1 ? pedido : actual;
  const [series, siglas] = await Promise.all([listarConsecutivos(anio), listarSiglasTramite()]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <CabeceraTablero icon={Hash} titulo="Consecutivos" descripcion="Siguiente número de cada serie por vigencia: expedientes de trámite (por sigla), conceptos técnicos, GECON, SGDEA y memorandos de cada oficina." />

      <div className="flex flex-wrap items-center gap-1.5">
        {[actual - 1, actual, actual + 1].map((a) => (
          <Link
            key={a}
            href={`/admin/consecutivos?anio=${a}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${a === anio ? "bg-stone-900 text-white" : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"}`}
          >
            {a}
          </Link>
        ))}
        <form action="/api/consecutivos" method="post" className="ml-auto">
          <input type="hidden" name="accion" value="reiniciar_libres" />
          <input type="hidden" name="anio" value={anio} />
          <button type="submit" className="rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50">
            Empezar en 1 las series sin registros de {anio}
          </button>
        </form>
      </div>

      {sp.ok && <div className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      <details id="siglas" className="group rounded-2xl border border-stone-200 bg-white shadow-soft">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-stone-900">
          Siglas de expediente por trámite
          <span className="text-xs font-normal text-stone-500">{siglas.filter((s) => s.sigla).length} de {siglas.length} trámites con sigla</span>
        </summary>
        <div className="border-t border-stone-100 px-4 py-2 text-xs text-stone-600">
          Los expedientes nuevos se numeran con la sigla del trámite, igual que en SINCA (por ejemplo CA-0082-{anio}). Los trámites con la misma sigla
          comparten el consecutivo, y la serie sigue después del último número que asignó SINCA en la vigencia. Los expedientes ya radicados conservan
          su número. Deje el campo vacío para volver a la sigla por defecto.
        </div>
        <div className="overflow-x-auto border-t border-stone-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-[11px] uppercase tracking-wide text-stone-500">
                <th className="px-4 py-2 font-medium">Procedimiento</th>
                <th className="px-2 py-2 font-medium">Trámite</th>
                <th className="px-4 py-2 font-medium">Sigla</th>
              </tr>
            </thead>
            <tbody>
              {siglas.map((t) => (
                <tr key={t.codigo} className="border-b border-stone-100 last:border-0">
                  <td className="whitespace-nowrap px-4 py-1.5 font-mono text-xs text-stone-600">{t.codigo}</td>
                  <td className="px-2 py-1.5">
                    {t.nombre}
                    {!t.sigla && <span className="ml-1.5 rounded-sm bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">sin sigla</span>}
                  </td>
                  <td className="px-4 py-1.5">
                    <form action="/api/consecutivos" method="post" className="flex items-center gap-1.5">
                      <input type="hidden" name="accion" value="sigla" />
                      <input type="hidden" name="codigo" value={t.codigo} />
                      <input type="hidden" name="anio" value={anio} />
                      <input type="hidden" name="nombre" value={t.nombre} />
                      <input
                        type="text"
                        name="sigla"
                        maxLength={4}
                        pattern="[A-Za-z]{2,4}"
                        defaultValue={t.sigla ?? ""}
                        placeholder={t.siglaPorDefecto ?? "—"}
                        aria-label={`Sigla de ${t.nombre}`}
                        className="w-16 rounded-md border border-stone-200 px-2 py-1 text-center font-mono text-xs uppercase"
                      />
                      <button type="submit" className="rounded-md border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50">
                        Guardar
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {MODULOS.map((m) => {
        const filas = series.filter((s) => s.modulo === m);
        if (filas.length === 0) return null;
        return (
          <details key={m} open={m !== "TRAMITES"} className="group rounded-2xl border border-stone-200 bg-white shadow-soft">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-stone-900">
              {ETIQUETA_MODULO_CONSECUTIVO[m]}
              <span className="text-xs font-normal text-stone-500">
                {filas.length} serie{filas.length === 1 ? "" : "s"} · {filas.reduce((n, f) => n + f.registros, 0)} registros en {anio}
              </span>
            </summary>
            <div className="overflow-x-auto border-t border-stone-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-[11px] uppercase tracking-wide text-stone-500">
                    <th className="px-4 py-2 font-medium">Serie</th>
                    <th className="px-2 py-2 font-medium">Próximo número</th>
                    <th className="px-2 py-2 text-right font-medium">Registros</th>
                    <th className="px-2 py-2 text-right font-medium">Último usado</th>
                    <th className="px-4 py-2 font-medium">Siguiente</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((s) => (
                    <tr key={s.serie} className="border-b border-stone-100 last:border-0">
                      <td className="px-4 py-1.5">
                        {s.nombre}
                        {!s.configurada && <span className="ml-1.5 rounded-sm bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">sin configurar</span>}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-xs text-stone-600">{s.ejemplo}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{s.registros}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{s.ultimoUsado || "—"}</td>
                      <td className="px-4 py-1.5">
                        <form action="/api/consecutivos" method="post" className="flex items-center gap-1.5">
                          <input type="hidden" name="serie" value={s.serie} />
                          <input type="hidden" name="anio" value={anio} />
                          <input type="hidden" name="nombre" value={s.nombre} />
                          <input
                            type="number"
                            name="siguiente"
                            min={s.ultimoUsado + 1}
                            max={999999}
                            defaultValue={s.siguiente}
                            aria-label={`Siguiente número de ${s.nombre}`}
                            className="w-24 rounded-md border border-stone-200 px-2 py-1 text-right text-xs tabular-nums"
                          />
                          <button type="submit" className="rounded-md border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50">
                            Guardar
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        );
      })}
    </div>
  );
}
