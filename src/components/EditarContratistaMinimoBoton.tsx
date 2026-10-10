"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";
import { RegistrarContratistaForm, type RepresentanteLegalForm } from "@/components/RegistrarContratistaForm";
import type { DatosPersona } from "@/lib/datos-persona";

export function EditarContratistaMinimoBoton({
  contratistaId,
  persona,
  representanteLegal,
}: {
  contratistaId: string;
  persona: DatosPersona;
  representanteLegal?: RepresentanteLegalForm;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
      >
        <PenLine className="h-3.5 w-3.5" aria-hidden />
        Editar datos
      </button>
    );
  }

  return (
    <RegistrarContratistaForm
      editando={{ contratistaId, persona, representanteLegal }}
      onRegistrado={() => {
        setEditando(false);
        router.refresh();
      }}
      onCancelar={() => setEditando(false)}
    />
  );
}
