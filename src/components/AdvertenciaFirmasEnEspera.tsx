import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { DIAS_ESPERA_AVISO, listarFirmasEnEspera } from "@/lib/firmas-en-espera";
import { formatearFechaHora } from "@/lib/fecha";
import { BotonRecordarFirma } from "@/components/BotonRecordarFirma";
import type { ModuloFirma } from "@/lib/jerarquia-firma";

/**
 * Advertencia en el buzón de firmas: documentos que la persona envió a firma o ya firmó y en los que
 * falta que otra persona (cuyo turno ya llegó) firme. Se muestra hasta que esa persona firme.
 */
export async function AdvertenciaFirmasEnEspera({ usuarioId, modulo, memorandos }: { usuarioId: string; modulo: ModuloFirma; memorandos?: boolean }) {
  const todas = await listarFirmasEnEspera(usuarioId).catch(() => []);
  const lista = todas.filter((f) => f.modulo === modulo && (memorandos === undefined || f.ruta.startsWith("/memorandos/") === memorandos));
  if (lista.length === 0) return null;
  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <AlertTriangle className="h-4 w-4 flex-none" aria-hidden />
        {lista.length === 1 ? "Falta una firma en un documento suyo" : `Faltan firmas en ${lista.length} documentos suyos`}
      </p>
      <ul className="mt-2 space-y-2">
        {lista.map((f) => (
          <li key={f.solicitudId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className={f.dias >= DIAS_ESPERA_AVISO ? "font-medium text-red-700" : "font-medium text-amber-900"}>
                Falta que {f.pendiente} {f.rol === "FIRMA" ? "firme" : "dé el visto bueno"}
                <span className="font-normal text-stone-600"> · {f.dias === 0 ? "desde hoy" : `hace ${f.dias} día(s)`}</span>
              </p>
              <p className="text-xs text-stone-600">
                <Link href={f.ruta} className="text-cdmb-700 hover:underline">
                  {f.documento}
                </Link>{" "}
                · {f.referencia}
                {f.recordadoEn ? ` · recordado el ${formatearFechaHora(f.recordadoEn)}` : ""}
              </p>
            </div>
            <BotonRecordarFirma solicitudId={f.solicitudId} nombre={f.pendiente} />
          </li>
        ))}
      </ul>
    </section>
  );
}
