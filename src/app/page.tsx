import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Inbox,
  Leaf,
  Briefcase,
  Mail,
  MessageCircleQuestion,
  Gavel,
  MapPin,
  FileWarning,
  ListChecks,
  PenLine,
  FileText,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerSeccionesAlertas, type SeccionAlertasModulo, type TipoAlerta } from "@/lib/alertas-landing";
import { saludo, horaBogota } from "@/lib/saludo";

const MODULOS: Record<SeccionAlertasModulo["modulo"], { icon: LucideIcon; bubble: string }> = {
  TRAMITES: { icon: Leaf, bubble: "bg-cdmb-100 text-cdmb-700" },
  GECON: { icon: Briefcase, bubble: "bg-amber-100 text-amber-700" },
  SGDEA: { icon: Mail, bubble: "bg-sky-100 text-sky-700" },
};

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

export default async function LandingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const secciones = await obtenerSeccionesAlertas(session);
  const primerNombre = session.nombre.trim().split(/\s+/)[0];
  const totalGeneral = secciones.reduce((acc, s) => acc + s.total, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">
          {saludo(horaBogota())}
          {primerNombre ? `, ${primerNombre}` : ""}
        </h1>
        <p className="text-sm text-stone-500">
          {secciones.length === 0
            ? "Todavía no tiene acceso a ningún módulo. Si cree que debería tenerlo, contacte a un administrador."
            : totalGeneral === 0
              ? "No tiene pendientes registrados en los módulos a los que tiene acceso."
              : `Tiene ${totalGeneral} pendiente${totalGeneral === 1 ? "" : "s"} en total entre sus módulos.`}
        </p>
      </div>

      {secciones.length > 1 && totalGeneral > 0 && (
        <div className="flex flex-wrap gap-2">
          {secciones.map((s) => {
            const { icon: Icon, bubble } = MODULOS[s.modulo];
            return (
              <a
                key={s.modulo}
                href={`#sec-${s.modulo}`}
                className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white py-1.5 pl-1.5 pr-3.5 shadow-soft transition hover:-translate-y-0.5 hover:border-cdmb-300 hover:shadow-md"
              >
                <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-full ${bubble}`}>
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span className="text-xs font-medium text-stone-700">{s.nombre}</span>
                {s.total > 0 && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">{s.total}</span>}
              </a>
            );
          })}
        </div>
      )}

      {secciones.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white p-10 text-center shadow-soft">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-stone-100">
            <Inbox className="h-7 w-7 text-stone-300" aria-hidden />
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {secciones.map((s) => {
            const { icon: ModuloIcon, bubble } = MODULOS[s.modulo];
            return (
              <section
                id={`sec-${s.modulo}`}
                key={s.modulo}
                className="flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-soft scroll-mt-4"
              >
                <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-5 py-3.5">
                  <h2 className="flex items-center gap-2.5 text-sm font-semibold text-stone-900">
                    <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-full ${bubble}`}>
                      <ModuloIcon className="h-4 w-4" aria-hidden />
                    </span>
                    {s.nombre}
                    {s.total > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{s.total}</span>}
                  </h2>
                  <Link href={s.masLink} className="inline-flex flex-none items-center gap-1 text-xs font-medium text-cdmb-700 hover:underline">
                    {s.masTexto} <ArrowRight className="h-3 w-3" aria-hidden />
                  </Link>
                </div>
                {s.items.length === 0 ? (
                  <p className="flex flex-1 items-center gap-2 px-5 py-8 text-sm text-stone-400">
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-emerald-50">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
                    </span>
                    Sin pendientes en este módulo.
                  </p>
                ) : (
                  <ul className="flex-1 divide-y divide-stone-100">
                    {s.items.map((item, i) => {
                      const { icon: TipoIcon, tint } = TIPOS[item.tipo];
                      return (
                        <li key={i}>
                          <Link href={item.link} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-stone-50">
                            <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-full ${tint}`}>
                              <TipoIcon className="h-4 w-4" aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-stone-800">{item.titulo}</span>
                              {item.detalle && <span className="block truncate text-xs text-stone-400">{item.detalle}</span>}
                            </span>
                            <ArrowRight className="h-3.5 w-3.5 flex-none text-stone-300" aria-hidden />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {s.total > s.items.length && (
                  <div className="border-t border-stone-100 px-5 py-2 text-right">
                    <Link href={s.masLink} className="text-xs font-medium text-cdmb-700 hover:underline">
                      Ver {s.total - s.items.length} más →
                    </Link>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
