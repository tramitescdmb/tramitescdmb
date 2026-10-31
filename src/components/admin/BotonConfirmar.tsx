"use client";

import type { ReactNode } from "react";

export function BotonConfirmar({ mensaje, className, disabled, children }: { mensaje: string; className?: string; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={`${className ?? ""} disabled:opacity-50`}
      onClick={(e) => {
        if (!window.confirm(mensaje)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
