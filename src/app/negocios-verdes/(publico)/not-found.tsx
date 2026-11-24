import Link from "next/link";
import { LOGO_CDMB_NV } from "@/lib/negocios-verdes-sitio";

export default function NoEncontradoNV() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_CDMB_NV} alt="CDMB" className="h-14 w-auto" />
      <h1 className="mt-4 text-[22px] font-semibold">No encontramos esta página</h1>
      <p className="mt-2 text-[13px] text-nv-texto2">Puede que el negocio que buscas ya no esté publicado o la dirección esté mal escrita.</p>
      <Link prefetch={false} href="/negocios-verdes" className="mt-6 rounded-[8px] bg-nv-acento px-6 py-2 text-sm font-semibold text-white hover:bg-nv-acento-oscuro">
        Volver al inicio
      </Link>
    </div>
  );
}
