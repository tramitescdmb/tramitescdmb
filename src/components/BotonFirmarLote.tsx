"use client";

import { useConfirmacionFirma } from "@/components/ConfirmacionIdentidadFirma";

export function BotonFirmarLote() {
  const { confirmarIdentidad, dialogo } = useConfirmacionFirma("SGDEA");

  return (
    <>
      <button
        type="submit"
        onClick={async (e) => {
          e.preventDefault();
          const form = e.currentTarget.form;
          if (!form) return;
          const n = form.querySelectorAll('input[name="comunicacionId"]:checked').length;
          if (n > 0 && !(await confirmarIdentidad({ detalle: `${n} comunicación(es) seleccionada(s) para firma en lote.` }))) return;
          form.requestSubmit();
        }}
        className="mt-3 rounded-md bg-acento-500 px-4 py-2 text-sm font-medium text-white hover:bg-acento-600"
      >
        Firmar seleccionadas
      </button>
      {dialogo}
    </>
  );
}
