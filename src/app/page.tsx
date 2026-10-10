import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, Inbox } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerSeccionesAlertas } from "@/lib/alertas-landing";
import { saludo, horaBogota } from "@/lib/saludo";

export default async function LandingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const secciones = await obtenerSeccionesAlertas(session);
  const primerNombre = session.nombre.trim().split(/\s+/)[0];
  const totalGeneral = secciones.reduce((acc, s) => acc + s.total, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">
          {saludo(horaBogota())}
          {primerNombre ? `, ${primerNombre}` : ""}
        </h1>
        <p className="text-sm text-stone-500">
          {secciones.length === 0
            ? "Todavía no tiene acceso a ningún módulo. Si cree que debería tenerlo, contacte a un administrador."
            : totalGeneral === 0
              ? "No tiene pendientes registrados en los módulos a los que tiene acceso."
              : `Tiene ${totalGeneral} pendiente${totalGeneral === 1 ? "" : "s"} en total entre sus módulos.`}
        </p>
      </div>

      {secciones.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white p-8 text-center shadow-soft">
          <Inbox className="mx-auto h-8 w-8 text-stone-300" aria-hidden />
        </div>
      ) : (
        secciones.map((s) => (
          <section key={s.modulo} className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-soft">
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                {s.nombre}
                {s.total > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{s.total}</span>}
              </h2>
              <Link href={s.masLink} className="inline-flex flex-none items-center gap-1 text-xs font-medium text-cdmb-700 hover:underline">
                {s.masTexto} <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </div>
            {s.items.length === 0 ? (
              <p className="flex items-center gap-2 px-5 py-6 text-sm text-stone-400">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
                Sin pendientes en este módulo.
              </p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {s.items.map((item, i) => (
                  <li key={i}>
                    <Link href={item.link} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-stone-50">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-stone-800">{item.titulo}</span>
                        {item.detalle && <span className="block truncate text-xs text-stone-400">{item.detalle}</span>}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 flex-none text-stone-300" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {s.total > s.items.length && (
              <div className="border-t border-stone-100 px-5 py-2 text-right">
                <Link href={s.masLink} className="text-xs font-medium text-cdmb-700 hover:underline">
                  Ver {s.total - s.items.length} más →
                </Link>
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}
