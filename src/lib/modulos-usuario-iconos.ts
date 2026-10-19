import { Archive, Briefcase, FileBadge, Link2, Mail, type LucideIcon } from "lucide-react";
import type { ModuloUsuario } from "@/lib/modulos-usuario";

export const ICONOS_MODULO: Record<ModuloUsuario, LucideIcon> = {
  TRAMITES: FileBadge,
  SGDEA: Mail,
  GECON: Briefcase,
  VITAL: Link2,
  SINCA: Archive,
};
