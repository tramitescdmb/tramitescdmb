import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox, PenLine, Eye, Lock } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { listarBuzon } from "@/lib/solicitudes-firma";
import { TituloSeccion } from "@/components/sgdea/ui";

const ETIQUETA_ROL: Record<string, string> = { FIRMA: "Debe firmar", VISTO_BUENO: "Debe dar visto bueno" };

export default async function BuzonCorrespondenciaPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const solicitudes = await listarBuzon(session.userId, "comunicacion");

  return (
    <section className="space-y-4">
      <TituloSeccion icon={Inbox}>Buzón de firmas</TituloSeccion>

      {solicitudes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-200 bg-stone-50/60 p-6 text-center text-sm text-stone-400">
          No tiene comunicaciones pendientes de firmar o revisar.
        </p>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white shadow-sm">
          {solicitudes.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-800">{s.comunicacion?.asunto}</p>
                <p className="text-xs text-stone-400">
                  {s.comunicacion?.radicado} · Asignado por {s.asignadoPor.nombre}
                </p>
              </div>
              <span className="flex-none rounded-full bg-cdmb-50 px-2 py-0.5 text-[11px] font-medium text-cdmb-700">{ETIQUETA_ROL[s.rol] ?? s.rol}</span>
              {s.puedeActuar ? (
                <Link
                  href={`/correspondencia/${s.comunicacion?.id}`}
                  className="inline-flex flex-none items-center gap-1 rounded-md bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700"
                >
                  <PenLine className="h-3.5 w-3.5" aria-hidden />
                  Ir a la comunicación
                </Link>
              ) : (
                <span className="inline-flex flex-none items-center gap-1 rounded-md border border-stone-200 px-3 py-1.5 text-xs text-stone-400" title="Debe(n) resolver primero quien(es) tiene(n) un turno anterior">
                  <Lock className="h-3.5 w-3.5" aria-hidden />
                  Esperando turno
                </span>
              )}
              <Link href={`/correspondencia/${s.comunicacion?.id}`} title="Ver la comunicación" className="flex-none text-stone-400 hover:text-stone-600">
                <Eye className="h-4 w-4" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
