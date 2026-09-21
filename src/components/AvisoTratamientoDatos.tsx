"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

/** Aviso de tratamiento de datos personales del primer ingreso (Directorio Activo o
 * correo/contraseña) — bloqueante hasta que el usuario decida. Adaptado de un ejemplo de
 * proveedor de firma electrónica externo (Signio), corrigiendo lo que no aplica: la CDMB opera
 * su propia plataforma y es la responsable directa del tratamiento (Ley 1581/2012), no un
 * proveedor SaaS revendiendo el servicio a un tercero. Enlaces de Términos/Política pendientes
 * de definir (`href="#"`), a pedido explícito del usuario. */
export function AvisoTratamientoDatos({ abierto }: { abierto: boolean }) {
  const router = useRouter();
  const [visible, setVisible] = useState(abierto);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!visible) return null;

  async function aceptar() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/mi-cuenta/aceptar-terminos", { method: "POST" });
      if (!res.ok) throw new Error("No se pudo registrar la aceptación. Intente de nuevo.");
      setVisible(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Aviso de tratamiento de datos personales" className="fixed inset-0 z-[100] flex items-center justify-center bg-graphite-900/60 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-soft-lg">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 flex-none text-cdmb-600" aria-hidden />
          <h2 className="text-base font-semibold text-graphite-900">Tratamiento de datos personales</h2>
        </div>

        <div className="space-y-3 text-sm leading-relaxed text-graphite-700">
          <p>
            Al hacer clic en «Autorizar y aceptar», usted acepta la versión vigente de los{" "}
            <a href="#" className="font-medium text-cdmb-700 hover:underline">Términos y condiciones</a> de Trámites CDMB.
          </p>
          <p>
            Así mismo, autoriza a la Corporación Autónoma Regional para la Defensa de la Meseta de Bucaramanga (CDMB) a
            recolectar, almacenar, usar y tratar su información personal conforme a las finalidades definidas en la{" "}
            <a href="#" className="font-medium text-cdmb-700 hover:underline">Política de tratamiento de datos personales</a>,
            de acuerdo con la Ley 1581 de 2012.
          </p>
          <p className="text-xs text-graphite-500">
            La CDMB es responsable del tratamiento de esta información como operadora de esta plataforma.
          </p>
        </div>

        {error && <p className="mt-3 text-xs text-red-700">{error}</p>}

        <div className="mt-5 flex items-center justify-end gap-3">
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="text-sm text-graphite-500 hover:text-graphite-700">
              Cerrar sesión
            </button>
          </form>
          <button
            type="button"
            onClick={aceptar}
            disabled={guardando}
            className="rounded-lg bg-cdmb-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-cdmb-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {guardando ? "Guardando…" : "Autorizar y aceptar"}
          </button>
        </div>
      </div>
    </div>
  );
}
