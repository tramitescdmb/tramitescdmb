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
        { campo: "logo", titulo: "Logo de Negocios Verdes", url: urlImagenNV(c?.logoRuta) },
        { campo: "govco", titulo: "Logo GOV.CO", url: urlImagenNV(c?.logoGovcoRuta) },
        { campo: "colombia", titulo: "Logo Colombia", url: urlImagenNV(c?.logoColombiaRuta) },
        { campo: "potencia", titulo: "Logo Potencia de la vida", url: urlImagenNV(c?.logoPotenciaRuta) },
      ]}
      banners={banners.map((b) => ({ id: b.id, imagenUrl: urlImagenNV(b.imagenRuta), urlDestino: b.urlDestino ?? "", abrirEnPestanaNueva: b.abrirEnPestanaNueva, orden: b.orden, activo: b.activo }))}
    />
  );
}
