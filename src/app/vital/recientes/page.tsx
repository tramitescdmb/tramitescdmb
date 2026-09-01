import Link from "next/link";
import { Inbox } from "lucide-react";
import { vitalConfigurado, nombreTramiteVital } from "@/lib/vital";
import { getVitalUltimasRadicadas } from "@/lib/vital-data";
import { SectionHelp } from "@/components/Field";

const fecha = (d: Date | null) => (d ? d.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" }) : "—");
const cuandoLlego = (d: Date | null) => {
  if (!d) return "sin fecha";
  const dias = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} días`;
  if (dias < 60) return "hace 1 mes";
  return `hace ${Math.floor(dias / 30)} meses`;
};

export default async function VitalRecientesPage() {
  if (!vitalConfigurado()) {
    return <SectionHelp>La conexión con VITAL no está configurada en este servidor.</SectionHelp>;
  }

  const recientes = await getVitalUltimasRadicadas(20);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-cdmb-200 bg-cdmb-50 px-3 py-2 text-sm text-cdmb-900">
        <Inbox className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
        <p>
          Lo más reciente que ha llegado del portal de VITAL, para <strong>no perder de vista una solicitud
          nueva</strong> mientras se resuelve la notificación por correo. Haga clic en cualquiera para ver el
          detalle.
        </p>
      </div>

      {recientes.length === 0 ? (
        <p className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-400">
          Todavía no se ha traído ninguna solicitud de VITAL.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-stone-200 bg-white divide-y divide-stone-100">
          {recientes.map((s) => (
            <li key={s.id}>
              <Link href={`/vital/${s.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-stone-50">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-medium text-cdmb-700">{s.idVital}</span>
                    <span className="text-stone-500">{nombreTramiteVital(s.idTramiteVital)}</span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-stone-500">
                    {s.solicitanteNombre ?? s.solicitanteIdentificacion ?? "Solicitante sin identificar"}
                    {s.nombreActividad ? ` · ${s.nombreActividad}` : ""}
                    {s._count.documentos ? ` · ${s._count.documentos} doc.` : ""}
                  </p>
                </div>
                <div className="flex-none text-right">
                  <p className="text-sm font-medium text-stone-800">{fecha(s.fechaRadicacion)}</p>
                  <p className="text-xs text-cdmb-700">{cuandoLlego(s.fechaRadicacion)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-stone-400">
        <Link href="/vital" className="text-cdmb-700 hover:underline">Ver todas las solicitudes →</Link>
      </p>
    </div>
  );
}
