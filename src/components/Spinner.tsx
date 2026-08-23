/** Ruedita de "cargando" — para botones y estados de espera. `claro` = para fondos de color (borde blanco). */
export function Spinner({ claro = false, className = "h-3.5 w-3.5" }: { claro?: boolean; className?: string }) {
  return (
    <span
      className={`inline-block flex-none animate-spin rounded-full border-2 border-t-transparent ${className} ${
        claro ? "border-white" : "border-cdmb-600"
      }`}
      aria-hidden
    />
  );
}
