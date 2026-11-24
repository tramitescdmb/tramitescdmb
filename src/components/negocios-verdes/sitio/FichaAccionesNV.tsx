"use client";

import { useEffect, useRef, useState } from "react";
import { Link2, Share2 } from "lucide-react";
import { IconBrandFacebook, IconBrandWhatsapp, IconBrandX } from "@tabler/icons-react";

/** QR con la dirección pública de la ficha (se arma en el navegador con la dirección por la que entró). */
export function QrNegocioNV({ slug, nombre }: { slug: string; nombre: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    import("bwip-js/browser").then(({ default: bwipjs }) => {
      const url = `${window.location.origin}/negocios-verdes/negocio/${encodeURIComponent(slug)}`;
      if (vivo) setSvg(bwipjs.toSVG({ bcid: "qrcode", text: url, scale: 2 }));
    });
    return () => {
      vivo = false;
    };
  }, [slug]);
  return (
    <div className="flex w-[108px] flex-col items-center">
      <div className="h-[110px] w-[110px] rounded-[12px] border border-nv-borde bg-white p-2 shadow-[0_3px_10px_rgba(0,0,0,0.10)] [&_svg]:h-full [&_svg]:w-full" role="img" aria-label={`Código QR de ${nombre}`} dangerouslySetInnerHTML={svg ? { __html: svg } : undefined} />
      <p className="mt-1.5 line-clamp-2 text-center text-[10.5px] text-nv-texto2">QR de {nombre}</p>
    </div>
  );
}

/** Botón «Compartir»: menú con WhatsApp, Facebook, X y copiar enlace (o el menú del sistema en el celular). */
export function CompartirNV({ nombre }: { nombre: string }) {
  const [abierto, setAbierto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [abierto]);
  const url = () => window.location.href.split("#")[0];
  const texto = `${nombre} — Negocios Verdes CDMB`;
  const abrir = (u: string) => {
    window.open(u, "_blank", "noopener,noreferrer");
    setAbierto(false);
  };
  const opcion = "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-nv-claro";
  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={async () => {
          if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
            await navigator.share({ title: texto, url: url() }).catch(() => undefined);
            return;
          }
          setAbierto((v) => !v);
        }}
        className="inline-flex items-center gap-2 rounded-[8px] border border-nv-vivo bg-white px-6 py-2 text-sm font-semibold text-nv-vivo hover:bg-nv-claro"
      >
        <Share2 className="h-[18px] w-[18px]" aria-hidden /> Compartir
      </button>
      {abierto && (
        <div role="menu" className="absolute left-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-[12px] border border-nv-borde bg-white py-1 shadow-lg">
          <button role="menuitem" type="button" className={opcion} onClick={() => abrir(`https://wa.me/?text=${encodeURIComponent(`${texto} ${url()}`)}`)}>
            <IconBrandWhatsapp className="h-5 w-5 text-nv-whatsapp" aria-hidden /> WhatsApp
          </button>
          <button role="menuitem" type="button" className={opcion} onClick={() => abrir(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url())}`)}>
            <IconBrandFacebook className="h-5 w-5 text-[#1877f2]" aria-hidden /> Facebook
          </button>
          <button role="menuitem" type="button" className={opcion} onClick={() => abrir(`https://twitter.com/intent/tweet?text=${encodeURIComponent(texto)}&url=${encodeURIComponent(url())}`)}>
            <IconBrandX className="h-5 w-5" aria-hidden /> X (Twitter)
          </button>
          <button
            role="menuitem"
            type="button"
            className={opcion}
            onClick={async () => {
              await navigator.clipboard.writeText(url()).catch(() => undefined);
              setAbierto(false);
              setAviso("Enlace copiado.");
              setTimeout(() => setAviso(null), 2500);
            }}
          >
            <Link2 className="h-5 w-5 text-nv-texto2" aria-hidden /> Copiar enlace
          </button>
        </div>
      )}
      {aviso && (
        <p role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-[8px] bg-nv-neutro px-4 py-2 text-sm text-white shadow-lg">
          {aviso}
        </p>
      )}
    </div>
  );
}
