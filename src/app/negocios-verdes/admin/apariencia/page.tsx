import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { verificarSesion, obtenerPermisosUsuario } from "@/lib/permisos";
import { puedeConfigurarNV } from "@/lib/negocios-verdes-permisos";
import { urlImagenNV } from "@/lib/negocios-verdes";
import { AparienciaNV } from "@/components/negocios-verdes/AparienciaNV";

export const dynamic = "force-dynamic";

export default async function AparienciaNegociosVerdes() {
  const session = await verificarSesion();
  const permisos = session ? await obtenerPermisosUsuario(session.userId) : null;
  if (!permisos || !puedeConfigurarNV(permisos)) notFound();
  const [c, banners] = await Promise.all([db.nvConfiguracion.findUnique({ where: { id: "singleton" } }), db.nvBanner.findMany({ orderBy: [{ orden: "asc" }, { creadoEn: "asc" }] })]);
  return (
    <AparienciaNV
      logos={[
        { campo: "logo", titulo: "Logo principal", ayuda: "Barra superior, inicio y menú del administrador.", url: urlImagenNV(c?.logoRuta) },
        { campo: "colombia", titulo: "Sello Colombia", ayuda: "Pie de página, junto al sello GOV.CO.", url: urlImagenNV(c?.logoColombiaRuta) },
        { campo: "potencia", titulo: "Sello Colombia Potencia de la Vida", ayuda: "Pie de página, a la derecha del sello de Colombia.", url: urlImagenNV(c?.logoPotenciaRuta) },
        { campo: "govco", titulo: "Sello GOV.CO", ayuda: "Pie de página. Use la versión blanca: el fondo es verde oscuro.", url: urlImagenNV(c?.logoGovcoRuta) },
      ]}
      banners={banners.map((b) => ({ id: b.id, imagenUrl: urlImagenNV(b.imagenRuta), urlDestino: b.urlDestino ?? "", abrirEnPestanaNueva: b.abrirEnPestanaNueva, orden: b.orden, activo: b.activo }))}
    />
  );
}
