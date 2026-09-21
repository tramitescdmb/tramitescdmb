import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederContratacion, puedeVerRegistroContratistas, puedeGestionarContratistas } from "@/lib/permisos";
import { ETIQUETA_ETAPA } from "@/lib/contratacion";
import { VincularExpedienteAContratistaForm } from "@/components/VincularExpedienteAContratistaForm";
import { regimenTributarioLabel } from "@/lib/regimen-tributario";
import { EditarContratistaForm } from "@/components/EditarContratistaForm";
import { EliminarContratistaBoton } from "@/components/EliminarContratistaBoton";

export default async function ContratistaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederContratacion(permisos)) redirect("/");
  if (!puedeVerRegistroContratistas(permisos)) redirect("/contratacion");

  const contratista = await db.contratista.findUnique({
    where: { id },
    include: {
      usuario: { select: { nombre: true, email: true } },
      expedientes: { orderBy: { createdAt: "desc" }, select: { id: true, numero: true, objeto: true, etapaActual: true, cerrado: true } },
    },
  });
  if (!contratista) notFound();

  const puedeGestionar = puedeGestionarContratistas(permisos);
  const vinculables = puedeGestionar
    ? await db.expedienteContractual.findMany({
        // Un contratista por expediente: solo se ofrecen los que todavía no tienen uno.
        where: { contratistaId: null },
        orderBy: { createdAt: "desc" },
        take: 300,
        select: { id: true, numero: true, objeto: true, etapaActual: true, cerrado: true },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/contratacion/contratistas" className="text-sm text-cdmb-700 hover:underline">
          ← Contratistas
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-stone-900">{contratista.nombreORazonSocial}</h1>
        <p className="text-sm text-stone-500">
          {contratista.tipoPersona === "JURIDICA" ? "NIT" : "Cédula"}: {contratista.identificacion} ·{" "}
          {contratista.tipoPersona === "JURIDICA" ? "Persona jurídica" : "Persona natural"}
        </p>
      </div>

      <section className="rounded-xl border border-stone-200 bg-white shadow-soft p-4">
        <h2 className="mb-2 text-sm font-semibold text-stone-900">Datos de contacto</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Correo</dt>
            <dd className="break-all text-stone-800">{contratista.contactoEmail ?? "—"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Teléfono</dt>
            <dd className="break-words text-stone-800">{contratista.contactoTelefono ?? "—"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Ciudad</dt>
            <dd className="break-words text-stone-800">
              {[contratista.ciudad, contratista.departamento].filter(Boolean).join(" — ") || "—"}
            </dd>
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
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-xs text-stone-400">Cuenta de acceso (Directorio Activo)</dt>
            <dd className="break-words text-stone-800">
              {contratista.usuario
                ? `${contratista.usuario.nombre} (${contratista.usuario.email})`
                : "No vinculada — se asigna desde Usuarios."}
            </dd>
          </div>
        </dl>

        {puedeGestionarContratistas(permisos) && (
          <EditarContratistaForm
            contratista={{
              id: contratista.id,
              tipoPersona: contratista.tipoPersona,
              nombres: contratista.nombres,
              apellidos: contratista.apellidos,
              nombreORazonSocial: contratista.nombreORazonSocial,
              regimenTributario: contratista.regimenTributario,
              granContribuyente: contratista.granContribuyente,
              contactoEmail: contratista.contactoEmail,
              contactoTelefono: contratista.contactoTelefono,
              direccion: contratista.direccion,
              departamento: contratista.departamento,
              ciudad: contratista.ciudad,
            }}
          />
        )}

        {puedeGestionarContratistas(permisos) && (
          <div className="mt-4 border-t border-stone-100 pt-3">
            {contratista.expedientes.length === 0 ? (
              <EliminarContratistaBoton contratistaId={contratista.id} nombre={contratista.nombreORazonSocial} tieneCuenta={Boolean(contratista.usuario)} />
            ) : (
              <p className="text-xs text-stone-400">
                No se puede eliminar mientras pertenezca a un expediente ({contratista.expedientes.length}). Reasígnelos a otro contratista o elimine esos expedientes primero.
              </p>
            )}
          </div>
        )}
      </section>

      {puedeGestionar && (
        <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-soft">
          <h2 className="mb-2 text-sm font-semibold text-stone-900">Vincular un expediente</h2>
          <VincularExpedienteAContratistaForm
            contratistaId={contratista.id}
            tieneCuenta={Boolean(contratista.usuario)}
            opciones={vinculables.map((e) => ({
              id: e.id,
              numero: e.numero,
              objeto: e.objeto,
              etapa: e.cerrado ? "Cerrado" : ETIQUETA_ETAPA[e.etapaActual],
            }))}
          />
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Expedientes de este contratista ({contratista.expedientes.length})
        </h2>
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-soft">
          {contratista.expedientes.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-stone-400">Todavía no tiene expedientes.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-stone-100 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Número</th>
                  <th className="px-4 py-2.5 font-medium">Objeto</th>
                  <th className="px-4 py-2.5 font-medium">Etapa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {contratista.expedientes.map((e) => (
                  <tr key={e.id} className="hover:bg-stone-50">
                    <td className="px-4 py-2.5">
                      <Link href={`/contratacion/expedientes/${e.id}`} className="font-medium text-cdmb-700 hover:underline">
                        {e.numero}
                      </Link>
                    </td>
                    <td className="max-w-xs truncate px-4 py-2.5 text-stone-700" title={e.objeto}>{e.objeto}</td>
                    <td className="px-4 py-2.5 text-stone-500">{e.cerrado ? "Cerrado" : ETIQUETA_ETAPA[e.etapaActual]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
