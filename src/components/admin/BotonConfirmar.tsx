"use client";

import type { ReactNode } from "react";

export function BotonConfirmar({
  mensaje,
  className,
  name,
  value,
  children,
}: {
  mensaje: string;
  className?: string;
  name?: string;
  value?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={className}
      onClick={(e) => {
        if (!window.confirm(mensaje)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
