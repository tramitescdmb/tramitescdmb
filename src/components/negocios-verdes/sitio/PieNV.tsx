import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { IconAt, IconBrandFacebook, IconBrandInstagram, IconBrandYoutube } from "@tabler/icons-react";
import { CONTACTO_CDMB } from "@/lib/negocios-verdes-sitio";

const EXPLORAR = [
  ["/negocios-verdes", "Inicio"],
  ["/negocios-verdes/buscar", "Buscar negocios"],
  ["/negocios-verdes/nosotros", "Qué son los Negocios Verdes"],
  ["/negocios-verdes/plan-nacional", "Plan Nacional 2022-2030"],
  ["/negocios-verdes/contacto", "Contacto"],
] as const;

export const REDES_NV = [
  { url: CONTACTO_CDMB.redes.facebook, etiqueta: "Facebook", Icono: IconBrandFacebook },
  { url: CONTACTO_CDMB.redes.x, etiqueta: "Twitter / X", Icono: IconAt },
  { url: CONTACTO_CDMB.redes.youtube, etiqueta: "YouTube", Icono: IconBrandYoutube },
  { url: CONTACTO_CDMB.redes.instagram, etiqueta: "Instagram", Icono: IconBrandInstagram },
];

function Dato({ icono: Icono, children }: { icono: typeof MapPin; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Icono className="mt-0.5 h-4 w-4 flex-none text-nv-vivo" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

/** Pie del sitio público: tres columnas (CDMB, contacto, explorar), redes y, si están cargados, los sellos. */
export function PieNV({ logoUrl, sellos }: { logoUrl: string; sellos: { url: string; alt: string }[] }) {
  return (
    <footer className="print:hidden">
      <div className="bg-white px-6 pb-6 pt-8">
        <div className="grid gap-8 md:grid-cols-[3fr_3fr_2fr]">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="CDMB" className="h-[30px] w-auto" />
            <p className="mt-3.5 font-semibold text-nv-texto">CDMB — Corporación Autónoma Regional para la Defensa de la Meseta de Bucaramanga</p>
            <p className="mt-1.5 text-[13px] text-nv-texto2">Ventanilla de Negocios Verdes · Directorio de negocios verdes en los 13 municipios de la jurisdicción CDMB.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/negocios-verdes/iconografia/logo_feria_nv_diagonal.png" alt="Feria Regional de Negocios Verdes" className="mt-2.5 h-6 w-auto" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-nv-oscuro">Contacto CDMB</p>
            <ul className="mt-3.5 space-y-2 text-[12.5px] text-nv-texto2">
              <Dato icono={MapPin}>{CONTACTO_CDMB.direccion}</Dato>
              <Dato icono={Clock}>{CONTACTO_CDMB.horario}</Dato>
              <Dato icono={Phone}>
                Conmutador {CONTACTO_CDMB.conmutador} · Línea gratuita {CONTACTO_CDMB.lineaGratuita}
              </Dato>
              <Dato icono={Mail}>
                <a href={`mailto:${CONTACTO_CDMB.correo}`} className="hover:underline">
                  {CONTACTO_CDMB.correo}
                </a>
              </Dato>
            </ul>
          </div>
          <div>
            <p className="text-[13px] font-bold text-nv-oscuro">Explorar</p>
            <ul className="mt-3.5 space-y-2.5 text-[13px] text-nv-texto2">
              {EXPLORAR.map(([href, t]) => (
                <li key={href}>
                  <Link prefetch={false} href={href} className="hover:text-nv-oscuro hover:underline">
                    {t}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2.5 border-t border-nv-borde pt-4">
          <p className="text-xs text-nv-texto2">© {new Date().getFullYear()} CDMB. Todos los derechos reservados.</p>
          <div className="flex items-center gap-0.5">
            <span className="mr-1 text-xs font-semibold text-nv-texto">Síguenos</span>
            {REDES_NV.map(({ url, etiqueta, Icono }) => (
              <a key={etiqueta} href={url} target="_blank" rel="noopener noreferrer" aria-label={etiqueta} title={etiqueta} className="rounded-full p-2 text-nv-vivo hover:bg-nv-claro">
                <Icono className="h-5 w-5" aria-hidden />
              </a>
            ))}
          </div>
        </div>
      </div>
      {sellos.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 bg-govco px-6 py-[18px]">
          {sellos.map((l) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={l.url} src={l.url} alt={l.alt} className="h-7 w-auto" />
          ))}
        </div>
      )}
    </footer>
  );
}
