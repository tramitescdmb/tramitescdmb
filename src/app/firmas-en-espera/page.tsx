import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Hourglass } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { DIAS_ESPERA_AVISO, listarFirmasEnEspera } from "@/lib/firmas-en-espera";
import { formatearFechaHora } from "@/lib/fecha";
import { CabeceraTablero } from "@/components/tablero";
import { BotonRecordarFirma } from "@/components/BotonRecordarFirma";

const MODULO: Record<string, string> = { TRAMITES: "Trámites", GECON: "GECON", SGDEA: "SGDEA / Memorandos" };
const USTED: Record<string, string> = { solicito: "Usted solicitó la firma", firmo: "Usted ya firmó", ambos: "Usted solicitó la firma y ya firmó" };

export const metadata = { title: "Firmas en espera" };

export default async function FirmasEnEsperaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const lista = await listarFirmasEnEspera(session.userId);
  const demoradas = lista.filter((f) => f.dias >= DIAS_ESPERA_AVISO).length;

  return (
    <div className="space-y-4">
      <CabeceraTablero
        icon={Hourglass}
        tono="acento"
        titulo="Firmas en espera"
        contador={lista.length > 0 ? lista.length : undefined}
        descripcion={`Documentos que usted envió a firma o ya firmó y que esperan la firma o el visto bueno de otra persona a la que ya le llegó el turno. Desde los ${DIAS_ESPERA_AVISO} días sin firmar le llega un aviso por correo; con «Recordar» le avisa a la persona en su buzón, su inicio y por correo.`}
      />

      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-soft">
        {lista.length === 0 ? (
          <p className="flex items-center gap-2 px-4 py-6 text-sm text-stone-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
            Ningún documento suyo espera la firma de otra persona.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {lista.map((f) => (
              <li key={f.solicitudId} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Link href={f.ruta} className="font-medium text-cdmb-700 hover:underline">
                    {f.documento}
                  </Link>{" "}
                  <span className="text-xs text-stone-500">
                    {f.referencia} · {MODULO[f.modulo] ?? f.modulo}
                  </span>
                  <p className={`text-xs ${f.dias >= DIAS_ESPERA_AVISO ? "font-medium text-red-700" : "text-stone-700"}`}>
                    {f.pendiente} no ha {f.rol === "FIRMA" ? "firmado" : "dado el visto bueno"} · pendiente desde el {formatearFechaHora(f.turnoDesde)} ({f.dias === 0 ? "hoy" : `${f.dias} día(s)`})
                  </p>
                  <p className="text-[11px] text-stone-400">
                    {USTED[f.usted]}
                    {f.recordadoEn ? ` · último recordatorio: ${formatearFechaHora(f.recordadoEn)}` : ""}
                  </p>
                </div>
                <div className="flex-none">
                  <BotonRecordarFirma solicitudId={f.solicitudId} nombre={f.pendiente} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {demoradas > 0 && <p className="text-xs text-stone-500">{demoradas} documento(s) llevan {DIAS_ESPERA_AVISO} días o más esperando.</p>}
    </div>
  );
}
