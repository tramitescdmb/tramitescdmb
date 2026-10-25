"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload } from "lucide-react";
import { EVENTO_COLA, listarPendientes, sincronizarPendientes, type RegistroPendiente } from "@/lib/cola-visitas";

export function SincronizadorVisitas() {
  const router = useRouter();
  const [pendientes, setPendientes] = useState<RegistroPendiente[]>([]);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!("indexedDB" in window)) return;
    let vivo = true;
    const refrescar = () => listarPendientes().then((l) => vivo && setPendientes(l));
    const sincronizar = async () => {
      if (!navigator.onLine) return;
      const actuales = await listarPendientes();
      if (actuales.length === 0) return;
      setEnviando(true);
      const r = await sincronizarPendientes().catch(() => ({ enviados: 0, pendientes: actuales.length }));
      if (!vivo) return;
      setEnviando(false);
      await refrescar();
      if (r.enviados > 0) router.refresh();
    };
    refrescar();
    sincronizar();
    window.addEventListener("online", sincronizar);
    window.addEventListener(EVENTO_COLA, refrescar);
    return () => {
      vivo = false;
      window.removeEventListener("online", sincronizar);
      window.removeEventListener(EVENTO_COLA, refrescar);
    };
  }, [router]);

  if (pendientes.length === 0) return null;
  const conError = pendientes.find((p) => p.ultimoError);
  return (
    <div className="encabezado-modulo">
      <p className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <CloudUpload className="h-4 w-4 flex-none" aria-hidden />
        {enviando ? "Enviando" : "Pendiente de envío"}: {pendientes.length} hoja(s) de visita guardada(s) en este dispositivo ({pendientes.map((p) => p.etiqueta).join("; ")}).
        {conError && !enviando && <span className="text-red-700">Último intento: {conError.ultimoError}</span>}
        {!enviando && (
          <button
            type="button"
            onClick={async () => {
              setEnviando(true);
              const r = await sincronizarPendientes();
              setEnviando(false);
              setPendientes(await listarPendientes());
              if (r.enviados > 0) router.refresh();
            }}
            className="font-semibold text-cdmb-700 hover:underline"
          >
            Enviar ahora
          </button>
        )}
      </p>
    </div>
  );
}
