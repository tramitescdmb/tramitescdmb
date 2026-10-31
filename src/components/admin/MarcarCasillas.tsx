"use client";

export function MarcarCasillas({ formulario, grupo, etiqueta }: { formulario: string; grupo?: string; etiqueta?: string }) {
  const marcar = (valor: boolean) => {
    const selector = `#${formulario} input[name="evento"]${grupo ? `[data-grupo="${grupo}"]` : ""}`;
    document.querySelectorAll<HTMLInputElement>(selector).forEach((casilla) => {
      casilla.checked = valor;
    });
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-normal text-stone-500">
      {etiqueta}
      <button type="button" onClick={() => marcar(true)} className="font-medium text-cdmb-700 hover:underline">
        Todos
      </button>
      <span aria-hidden>·</span>
      <button type="button" onClick={() => marcar(false)} className="font-medium text-cdmb-700 hover:underline">
        Ninguno
      </button>
    </span>
  );
}
