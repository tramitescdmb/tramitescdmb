"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { GrupoMenu, ItemMenu } from "@/components/BarraModulo";

export type MenuPublicado = { grupos: GrupoMenu[]; esItemActivo?: (item: ItemMenu, pathname: string) => boolean };

type Contexto = {
  menu: MenuPublicado | null;
  publicar: (menu: MenuPublicado | null) => void;
  expandido: boolean;
  setExpandido: (valor: boolean) => void;
};

const MenuModuloContext = createContext<Contexto>({ menu: null, publicar: () => {}, expandido: false, setExpandido: () => {} });

const CLAVE = "menu-lateral";

export function ProveedorMenuModulo({ children }: { children: ReactNode }) {
  const [menu, publicar] = useState<MenuPublicado | null>(null);
  const [expandido, setEstado] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem(CLAVE) === "contraido") setEstado(false);
    } catch {}
  }, []);

  function setExpandido(valor: boolean) {
    setEstado(valor);
    try {
      localStorage.setItem(CLAVE, valor ? "expandido" : "contraido");
    } catch {}
  }

  return <MenuModuloContext.Provider value={{ menu, publicar, expandido, setExpandido }}>{children}</MenuModuloContext.Provider>;
}

export function useMenuModulo() {
  return useContext(MenuModuloContext);
}

function firma(grupos: GrupoMenu[]) {
  return JSON.stringify(
    grupos.map((g) => [g.label, g.href, g.bloqueadoPara, g.insignia, (g.items ?? []).map((i) => [i.href, i.label, i.bloqueadoPara, i.insignia])])
  );
}

export function usePublicarMenu(menu: MenuPublicado) {
  const { publicar } = useMenuModulo();
  const clave = firma(menu.grupos);
  useEffect(() => {
    publicar(menu);
    return () => publicar(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, publicar]);
}
