"use client";

import type { ReactNode } from "react";

export function BotonConfirmar({ mensaje, className, children }: { mensaje: string; className?: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(mensaje)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
