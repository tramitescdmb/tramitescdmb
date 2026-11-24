import type { Metadata } from "next";
import { Clock, Globe, Mail, MapPin, Phone } from "lucide-react";
import { IconBrandFacebook, IconBrandInstagram, IconBrandX, IconBrandYoutube } from "@tabler/icons-react";
import { CONTACTO_CDMB as C } from "@/lib/negocios-verdes-sitio";

export const metadata: Metadata = { title: "Contacto", description: "Datos de contacto de la Ventanilla de Negocios Verdes de la CDMB." };

const tel = (t: string) => `tel:${t.replace(/[^\d+]/g, "")}`;

export default function ContactoNV() {
  const fila = "flex items-start gap-3 text-stone-700";
  const icono = "mt-0.5 h-5 w-5 flex-none text-emerald-700";
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold text-stone-900">Contacto</h1>
      <section className="flex flex-col gap-6 rounded-2xl border border-stone-200 bg-white p-6 sm:flex-row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/negocios-verdes/iconografia/colibri_2.png" alt="" className="h-24 w-32 flex-none object-contain" />
        <div className="flex-1 space-y-3">
          <h2 className="text-lg font-semibold text-stone-900">Ventanilla de Negocios Verdes — CDMB</h2>
          <ul className="space-y-2.5 text-sm">
            <li className={fila}><MapPin className={icono} aria-hidden /> {C.direccion}</li>
            <li className={fila}><Clock className={icono} aria-hidden /> {C.horario}</li>
            <li className={fila}><Phone className={icono} aria-hidden /><span>Conmutador <a href={tel(C.conmutador)} className="text-emerald-700 hover:underline">{C.conmutador}</a></span></li>
            <li className={fila}><Phone className={icono} aria-hidden /><span>Celular <a href={tel(C.celular)} className="text-emerald-700 hover:underline">{C.celular}</a></span></li>
            <li className={fila}><Phone className={icono} aria-hidden /><span>Línea gratuita <a href={tel(C.lineaGratuita)} className="text-emerald-700 hover:underline">{C.lineaGratuita}</a></span></li>
            <li className={fila}><Mail className={icono} aria-hidden /><a href={`mailto:${C.correo}`} className="text-emerald-700 hover:underline">{C.correo}</a></li>
            <li className={fila}><Globe className={icono} aria-hidden /><a href={C.web} target="_blank" rel="noopener" className="text-emerald-700 hover:underline">www.cdmb.gov.co</a></li>
          </ul>
          <div className="flex gap-3 pt-1 text-stone-500">
            <a href={C.redes.facebook} target="_blank" rel="noopener" aria-label="Facebook de la CDMB" className="hover:text-emerald-700"><IconBrandFacebook className="h-6 w-6" /></a>
            <a href={C.redes.instagram} target="_blank" rel="noopener" aria-label="Instagram de la CDMB" className="hover:text-emerald-700"><IconBrandInstagram className="h-6 w-6" /></a>
            <a href={C.redes.youtube} target="_blank" rel="noopener" aria-label="YouTube de la CDMB" className="hover:text-emerald-700"><IconBrandYoutube className="h-6 w-6" /></a>
            <a href={C.redes.x} target="_blank" rel="noopener" aria-label="X de la CDMB" className="hover:text-emerald-700"><IconBrandX className="h-6 w-6" /></a>
          </div>
        </div>
      </section>
      <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
        Estos son los canales institucionales de la CDMB. Si escribe por un negocio verde, mencione «Negocios Verdes» para que lo dirijan a la Ventanilla.
      </p>
    </article>
  );
}
