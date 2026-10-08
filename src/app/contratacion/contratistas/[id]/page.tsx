import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederContratacion, puedeVerRegistroContratistas, puedeGestionarContratistas } from "@/lib/permisos";
import { ETIQUETA_ETAPA, faltantesContratista, puedeEditarDatosDeContratista, SELECT_USUARIO_CONTRATISTA, vigenciaDeExpediente } from "@/lib/contratacion";
import { VincularExpedienteAContratistaForm } from "@/components/VincularExpedienteAContratistaForm";
import { regimenTributarioLabel } from "@/lib/regimen-tributario";
import { EditarContratistaForm } from "@/components/EditarContratistaForm";
import { EliminarContratistaBoton } from "@/components/EliminarContratistaBoton";
import { personaDesdeUsuario } from "@/lib/usuarios-persona";
import { formatearPesosCO } from "@/lib/moneda";

function fechaCorta(d: Date): string {
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export default async function ContratistaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederContratacion(permisos)) redirect("/");
  if (!puedeVerRegistroContratistas(permisos)) redirect("/contratacion");

  const puedeGestionar = puedeGestionarContratistas(permisos);
  const [contratista, vinculables] = await Promise.all([
    db.contratista.findUnique({
      where: { id },
      include: {
        usuario: { select: SELECT_USUARIO_CONTRATISTA },
        expedientes: {
          where: { eliminado: false },
          orderBy: [{ fechaInicio: "desc" }, { createdAt: "desc" }],
          select: { id: true, numero: true, objeto: true, valor: true, etapaActual: true, cerrado: true, fechaInicio: true, fechaFinEstimada: true, createdAt: true },
        },
      },
    }),
    puedeGestionar
      ? db.expedienteContractual.findMany({
          where: { contratistaId: null, eliminado: false },
          orderBy: { createdAt: "desc" },
          take: 300,
          select: { id: true, numero: true, objeto: true, etapaActual: true, cerrado: true },
        })
      : Promise.resolve([]),
  ]);
  if (!contratista) notFound();

  const usuario = contratista.usuario;
  const faltan = usuario ? faltantesContratista(usuario) : [];
  const editable = Boolean(usuario) && puedeGestionar && (permisos.esAdmin || puedeEditarDatosDeContratista(usuario!));
  const porVigencia = new Map<number, typeof contratista.expedientes>();
  for (const e of contratista.expedientes) {
    const v = vigenciaDeExpediente(e.fechaInicio, e.createdAt);
    porVigencia.set(v, [...(porVigencia.get(v) ?? []), e]);
  }
  const activos = contratista.expedientes.filter((e) => !e.cerrado && e.etapaActual === "CONTRACTUAL");
  const celular = usuario?.celular ?? contratista.contactoCelular;
  const telefono = usuario?.telefono ?? contratista.contactoTelefono;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/contratacion/contratistas" className="text-sm text-cdmb-700 hover:underline">
          ← Contratistas
        </Link>
        <h1 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-semibold text-stone-900">
          {contratista.nombreORazonSocial}
          {activos.length > 0 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Contrato activo</span>}
        </h1>
        <p className="text-sm text-stone-500">
          {contratista.tipoPersona === "JURIDICA" ? "NIT" : "C.C."} {contratista.identificacion} ·{" "}
          {contratista.tipoPersona === "JURIDICA" ? "Persona jurídica" : "Persona natural"}
          {usuario ? ` · Usuario ${usuario.email}` : ""}
          {usuario && permisos.esAdmin && (
            <>
              {" · "}
              <Link href={`/usuarios/${usuario.id}`} className="text-cdmb-700 hover:underline">
                Ver en Usuarios
              </Link>
            </>
          )}
        </p>
      </div>

      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-soft">
        <h2 className="mb-2 text-sm font-semibold text-stone-900">Datos personales</h2>
        {faltan.length > 0 && (
          <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">Para iniciar un contrato faltan: {faltan.join(", ")}.</p>
        )}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Correo</dt>
            <dd className="break-all text-stone-800">{usuario?.correoNotificacion ?? contratista.contactoEmail ?? "—"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Celular / teléfono</dt>
            <dd className="break-words text-stone-800">{[celular, telefono].filter(Boolean).join(" · ") || "—"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Ciudad</dt>
            <dd className="break-words text-stone-800">{[contratista.ciudad, contratista.departamento].filter(Boolean).join(", ") || "—"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Dirección</dt>
            <dd className="break-words text-stone-800">{contratista.direccion ?? "—"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Régimen tributario</dt>
            <dd className="break-words text-stone-800">
              {regimenTributarioLabel(contratista.regimenTributario)}
              {contratista.granContribuyente ? " · Gran contribuyente" : ""}
            </dd>
          </div>
        </dl>

        {editable && usuario && <EditarContratistaForm usuarioId={usuario.id} persona={personaDesdeUsuario(usuario)} />}

        {puedeGestionar && contratista.expedientes.length === 0 && (
          <div className="mt-4 border-t border-stone-100 pt-3">
            <EliminarContratistaBoton contratistaId={contratista.id} nombre={contratista.nombreORazonSocial} tieneCuenta={Boolean(usuario)} />
          </div>
        )}
      </section>

      {puedeGestionar && (
        <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-soft">
          <h2 className="mb-2 text-sm font-semibold text-stone-900">Vincular un expediente</h2>
          <VincularExpedienteAContratistaForm
            contratistaId={contratista.id}
            usuarioId={usuario?.id ?? null}
            opciones={vinculables.map((e) => ({
              id: e.id,
              numero: e.numero,
              objeto: e.objeto,
              etapa: e.cerrado ? "Cerrado" : ETIQUETA_ETAPA[e.etapaActual],
            }))}
          />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Contratos por vigencia ({contratista.expedientes.length})</h2>
        {contratista.expedientes.length === 0 ? (
          <p className="rounded-xl border border-stone-200 bg-white px-5 py-10 text-center text-sm text-stone-400 shadow-soft">Todavía no tiene expedientes.</p>
        ) : (
          Array.from(porVigencia.entries())
            .sort((a, b) => b[0] - a[0])
            .map(([vigencia, expedientes]) => (
              <div key={vigencia} className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-soft">
                <p className="border-b border-stone-100 bg-stone-50 px-4 py-2 text-xs font-semibold text-stone-700">
                  Vigencia {vigencia} · {expedientes.length} contrato{expedientes.length === 1 ? "" : "s"}
                </p>
                <table className="w-full text-xs">
                  <thead className="border-b border-stone-100 text-left text-[11px] uppercase tracking-wide text-stone-400">
                    <tr>
                      <th className="px-4 py-2 font-medium">Número</th>
                      <th className="px-4 py-2 font-medium">Objeto</th>
                      <th className="px-4 py-2 font-medium">Periodo</th>
                      <th className="px-4 py-2 font-medium">Valor</th>
                      <th className="px-4 py-2 font-medium">Etapa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {expedientes.map((e) => (
                      <tr key={e.id} className="hover:bg-stone-50">
                        <td className="px-4 py-2">
                          <Link href={`/contratacion/expedientes/${e.id}`} className="font-medium text-cdmb-700 hover:underline">
                            {e.numero}
                          </Link>
                        </td>
                        <td className="max-w-xs truncate px-4 py-2 text-stone-700" title={e.objeto}>
                          {e.objeto}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-stone-500">
                          {e.fechaInicio ? fechaCorta(e.fechaInicio) : "Sin acta de inicio"}
                          {e.fechaFinEstimada ? ` – ${fechaCorta(e.fechaFinEstimada)}` : ""}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-stone-500">{e.valor != null ? formatearPesosCO(Number(e.valor)) : "—"}</td>
                        <td className="px-4 py-2">
                          {e.cerrado ? (
                            <span className="text-stone-500">Cerrado</span>
                          ) : e.etapaActual === "CONTRACTUAL" ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">En ejecución</span>
                          ) : (
                            <span className="text-stone-500">{ETIQUETA_ETAPA[e.etapaActual]}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
        )}
      </section>
    </div>
  );
}
