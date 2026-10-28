"use client";

import { useEffect } from "react";
import { registrarReciente } from "@/lib/recientes";

export function RegistrarReciente({ href, titulo, detalle, modulo }: { href: string; titulo: string; detalle?: string; modulo: string }) {
  useEffect(() => {
    registrarReciente({ href, titulo, detalle, modulo });
  }, [href, titulo, detalle, modulo]);
  return null;
}
