"use client";

/** Borde arrastrable de una columna — para ensancharla o angostarla, como en Excel. Doble clic restablece su ancho. */
export function ManijaRedimension({
  anchoActual,
  onCambiar,
  onRestablecer,
}: {
  anchoActual: number;
  onCambiar: (nuevoAncho: number) => void;
  onRestablecer: () => void;
}) {
  function iniciar(e: React.PointerEvent<HTMLSpanElement>) {
    e.preventDefault();
    e.stopPropagation();
    const xInicial = e.clientX;
    const anchoInicial = anchoActual;
    function mover(ev: PointerEvent) {
      onCambiar(anchoInicial + (ev.clientX - xInicial));
    }
    function soltar() {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
    }
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  }

  return (
    <span
      onPointerDown={iniciar}
      onDoubleClick={onRestablecer}
      title="Arrastrar para cambiar el ancho de la columna — doble clic para restablecerlo"
      className="absolute right-0 top-0 z-10 h-full w-2 -mr-1 cursor-col-resize touch-none select-none hover:bg-cdmb-300 active:bg-cdmb-400"
    />
  );
}
