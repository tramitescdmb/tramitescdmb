import Link from "next/link";
import { LayoutGrid, FilePlus2, Search, ShieldCheck } from "lucide-react";
import { getConfiguracionSitio } from "@/lib/config-sitio";

const ACCESOS = [
  { href: "/", label: "Aplicativos CDMB", icono: LayoutGrid },
  { href: "/pqrsd", label: "Radicar PQRSD", icono: FilePlus2 },
  { href: "/pqrsd/consultar", label: "Consultar estado", icono: Search },
  { href: "/validar-firma", label: "Validador de firmas", icono: ShieldCheck },
];

export async function FranjaGovCo() {
  const config = await getConfiguracionSitio();

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-[#3366CC] px-4 py-1.5">
      {config.logoGovcoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={config.logoGovcoUrl} alt="GOV.CO" className="h-5 w-auto" />
      ) : (
        <span />
      )}
      <nav aria-label="Servicios al ciudadano" className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {ACCESOS.map((a) => {
          const Icono = a.icono;
          return (
            <Link
              key={a.href}
              prefetch={false}
              href={a.href}
              className="flex items-center gap-1 text-xs font-medium text-white/90 underline-offset-2 hover:text-white hover:underline"
            >
              <Icono className="h-3.5 w-3.5" aria-hidden />
              {a.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
