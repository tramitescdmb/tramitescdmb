"use client";

import { createContext, useContext } from "react";

export type UsuarioFirmaOpcion = { id: string; nombre: string; dependenciaNombre?: string | null };

const Contexto = createContext<UsuarioFirmaOpcion[] | null>(null);

export function ProveedorUsuariosFirma({ usuarios, children }: { usuarios: UsuarioFirmaOpcion[]; children: React.ReactNode }) {
  return <Contexto.Provider value={usuarios}>{children}</Contexto.Provider>;
}

export function useUsuariosFirma(propios?: UsuarioFirmaOpcion[]): UsuarioFirmaOpcion[] {
  const delContexto = useContext(Contexto);
  return propios ?? delContexto ?? [];
}
