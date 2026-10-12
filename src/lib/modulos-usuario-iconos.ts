import { Archive, Briefcase, Leaf, Link2, Mail, type LucideIcon } from "lucide-react";
import type { ModuloUsuario } from "@/lib/modulos-usuario";

export const ICONOS_MODULO: Record<ModuloUsuario, LucideIcon> = {
  TRAMITES: Leaf,
  SGDEA: Mail,
  GECON: Briefcase,
  VITAL: Link2,
  SINCA: Archive,
};
