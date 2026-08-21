"use client";

import { IconX } from "@/components/icons";

export function EliminarDocumentoBoton({ documentoId, nombre }: { documentoId: string; nombre: string }) {
  return (
    <form
      action={`/api/documentos/${documentoId}/eliminar`}
      method="post"
      onSubmit={(e) => {
        if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        title="Eliminar documento"
        className="flex-none rounded p-1 text-stone-300 hover:bg-red-50 hover:text-red-600"
      >
        <IconX className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}
