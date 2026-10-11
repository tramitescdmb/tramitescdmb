"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, UserPlus } from "lucide-react";
import { RegistrarContratistaForm } from "@/components/RegistrarContratistaForm";

export function NuevoContratistaSeccion() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="rounded-2xl border border-dashed border-cdmb-300 bg-cdmb-50/40 p-5">
      <button type="button" onClick={() => setAbierto((v) => !v)} className="flex w-full items-center gap-2 text-left">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-cdmb-100 text-cdmb-700">
          <UserPlus className="h-4 w-4" aria-hidden />
        </span>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-stone-900">+ Registrar contratista nuevo</h2>
          <p className="text-xs text-stone-400">Persona natural o jurídica que todavía no tiene expediente ni usuario en la plataforma.</p>
        </div>
        <ChevronDown className={`h-4 w-4 flex-none text-stone-400 transition-transform ${abierto ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {abierto && (
        <div className="mt-4">
          <RegistrarContratistaForm onRegistrado={(c) => router.push(`/contratacion/contratistas/${c.contratistaId}`)} onCancelar={() => setAbierto(false)} />
        </div>
      )}
    </div>
  );
}
