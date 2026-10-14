"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  FileText,
  FileWarning,
  Gavel,
  Inbox,
  Leaf,
  ListChecks,
  Mail,
  MapPin,
  MessageCircleQuestion,
  PenLine,
  UserX,
  type LucideIcon,
} from "lucide-react";
import type { SeccionAlertasModulo, TipoAlerta } from "@/lib/alertas-landing";

const MODULOS: Record<SeccionAlertasModulo["modulo"], { icon: LucideIcon; corto: string; barra: string; burbuja: string }> = {
  TRAMITES: { icon: Leaf, corto: "Trámites 2.0", barra: "bg-cdmb-500", burbuja: "bg-cdmb-100 text-cdmb-700" },
  GECON: { icon: Briefcase, corto: "GECON", barra: "bg-amber-400", burbuja: "bg-amber-100 text-amber-700" },
  SGDEA: { icon: Mail, corto: "SGDEA", barra: "bg-sky-400", burbuja: "bg-sky-100 text-sky-700" },
};

const VISIBLES = 6;

const TIPOS: Record<TipoAlerta, { icon: LucideIcon; tint: string }> = {
  informacion: { icon: MessageCircleQuestion, tint: "bg-sky-50 text-sky-600" },
  decision: { icon: Gavel, tint: "bg-violet-50 text-violet-600" },
  visita: { icon: MapPin, tint: "bg-emerald-50 text-emerald-600" },
  documento: { icon: FileWarning, tint: "bg-amber-50 text-amber-600" },
  paso: { icon: ListChecks, tint: "bg-cdmb-50 text-cdmb-600" },
  firma: { icon: PenLine, tint: "bg-red-50 text-red-600" },
  informe: { icon: FileText, tint: "bg-amber-50 text-amber-600" },
  contratista: { icon: UserX, tint: "bg-stone-100 text-stone-500" },
  correspondencia: { icon: Mail, tint: "bg-sky-50 text-sky-600" },
  flujo: { icon: Inbox, tint: "bg-stone-100 text-stone-500" },
};

export function BandejaPendientes({ secciones }: { secciones: SeccionAlertasModulo[] }) {
  const [activo, setActivo] = useState<SeccionAlertasModulo["modulo"] | "TODOS">("TODOS");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const total = secciones.reduce((a, s) => a + s.total, 0);
  const visibles = activo === "TODOS" ? secciones : secciones.filter((s) => s.modulo === activo);
  const items = visibles.flatMap((s) => (expandidos.has(s.modulo) ? s.items : s.items.slice(0, VISIBLES)).map((item) => ({ ...item, modulo: s.modulo })));
  const seccionActiva = activo === "TODOS" ? null : secciones.find((s) => s.modulo === activo);

  const pestanas = [
    { id: "TODOS" as const, etiqueta: "Todos", total },
    ...secciones.map((s) => ({ id: s.modulo, etiqueta: MODULOS[s.modulo].corto, total: s.total })),
  ];

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-soft">
      <div className="flex items-center gap-2 px-5 pb-2 pt-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-acento-50 text-acento-600">
          <Inbox className="h-4 w-4" aria-hidden />
        </span>
        <h2 className="text-sm font-semibold text-stone-900">Pendientes</h2>
      </div>

      {secciones.length > 1 && (
        <nav className="flex gap-1 overflow-x-auto px-4 pb-2" aria-label="Filtrar por módulo">
          {pestanas.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActivo(p.id)}
              className={`inline-flex flex-none items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                activo === p.id ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-100 hover:text-stone-800"
              }`}
            >
              {p.etiqueta}
              {p.total > 0 && (
                <span className={`rounded-full px-1.5 text-[10px] ${activo === p.id ? "bg-white/20" : "bg-amber-100 text-amber-800"}`}>{p.total}</span>
              )}
            </button>
          ))}
        </nav>
      )}

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden />
          </span>
          <p className="text-sm text-stone-400">Sin pendientes.</p>
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-stone-100 border-t border-stone-100">
          {items.map((item, i) => {
            const { icon: TipoIcon, tint } = TIPOS[item.tipo];
            return (
              <li key={i}>
                <Link href={item.link} className="group relative flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-stone-50">
                  <span className={`absolute inset-y-2 left-0 w-1 rounded-r-full ${MODULOS[item.modulo].barra}`} aria-hidden />
                  <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-full ${tint}`}>
                    <TipoIcon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-stone-800">{item.titulo}</span>
                    {item.detalle && <span className="block truncate text-xs text-stone-400">{item.detalle}</span>}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 flex-none text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-cdmb-600" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-stone-100 px-5 py-2.5">
        {(seccionActiva ? [seccionActiva] : secciones).map((s) => {
          const { icon: Icon, burbuja } = MODULOS[s.modulo];
          const ocultos = expandidos.has(s.modulo) ? 0 : Math.max(0, s.items.length - VISIBLES);
          const burbujaIcono = (
            <span className={`flex h-5 w-5 items-center justify-center rounded-full ${burbuja}`}>
              <Icon className="h-3 w-3" aria-hidden />
            </span>
          );
          return ocultos > 0 ? (
            <button
              key={s.modulo}
              type="button"
              onClick={() => setExpandidos((prev) => new Set(prev).add(s.modulo))}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-cdmb-700"
            >
              {burbujaIcono}
              {MODULOS[s.modulo].corto}: ver {ocultos} más
            </button>
          ) : (
            <Link key={s.modulo} href={s.masLink} className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-cdmb-700">
              {burbujaIcono}
              Ir a {MODULOS[s.modulo].corto}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
