import { textoPendientesFirma, type ResumenPendientesFirma } from "@/lib/calidad-firma";

export function GloboPendientes({ pendientes }: { pendientes: ResumenPendientesFirma }) {
  const titulo = textoPendientesFirma(pendientes);
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white ${pendientes.listos > 0 ? "bg-red-600" : "bg-stone-400"}`}
      title={titulo}
      aria-label={titulo}
    >
      {pendientes.total}
    </span>
  );
}
