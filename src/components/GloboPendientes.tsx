export function GloboPendientes({ pendientes }: { pendientes: { total: number; listos: number } }) {
  const titulo = `${pendientes.total} pendiente${pendientes.total === 1 ? "" : "s"} por firmar o revisar${
    pendientes.listos < pendientes.total ? ` (${pendientes.listos} ya puede${pendientes.listos === 1 ? "" : "n"} atenderse)` : ""
  }`;
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
