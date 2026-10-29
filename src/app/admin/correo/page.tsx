import { redirect } from "next/navigation";
import { Mail, CheckCircle2, CircleDashed, Send } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { CabeceraTablero } from "@/components/tablero";
import { correoConfigurado, estadoConfiguracionCorreo } from "@/lib/correo-microsoft";

function Item({ listo, texto }: { listo: boolean; texto: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {listo ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden /> : <CircleDashed className="h-4 w-4 text-stone-400" aria-hidden />}
      <span className={listo ? "text-stone-800" : "text-stone-500"}>{texto}</span>
    </li>
  );
}

export default async function CorreoInstitucionalPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") return <AccesoRestringido titulo="Correo institucional" quien="administrador del sistema" volverHref="/" volverLabel="Ir al inicio" />;
  const sp = await searchParams;
  const estado = estadoConfiguracionCorreo();
  const listo = correoConfigurado();
  const usuario = await db.usuario.findUnique({ where: { id: session.userId }, select: { correoNotificacion: true } });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <CabeceraTablero
        icon={Mail}
        titulo="Correo institucional"
        descripcion="Envío de correos desde una cuenta @cdmb.gov.co de Microsoft 365, por Microsoft Graph con un registro de aplicación del tenant. No usa contraseñas de usuarios ni modifica la autenticación multifactor."
      />
      {sp.ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      <section className="rounded-md border border-stone-200 bg-white p-4">
        <p className="mb-2 text-sm font-semibold text-stone-900">Configuración del servidor</p>
        <ul className="space-y-1.5">
          <Item listo={estado.tenant} texto="Identificador del tenant (MS_TENANT_ID)" />
          <Item listo={estado.aplicacion} texto="Identificador de la aplicación (MS_CLIENT_ID)" />
          <Item listo={estado.secreto} texto="Secreto de la aplicación (MS_CLIENT_SECRET)" />
          <Item listo={Boolean(estado.remitente)} texto={`Buzón remitente (MS_CORREO_REMITENTE)${estado.remitente ? `: ${estado.remitente}` : ""}`} />
        </ul>
      </section>

      <form action="/api/admin/correo/prueba" method="post" className="flex flex-wrap items-end gap-2 rounded-md border border-stone-200 bg-white p-4">
        <label className="min-w-64 flex-1 text-sm">
          <span className="mb-1 block text-xs text-stone-500">Enviar un correo de prueba a</span>
          <input name="destino" type="email" defaultValue={usuario?.correoNotificacion ?? ""} placeholder="nombre@cdmb.gov.co" className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
        </label>
        <button disabled={!listo} className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700 disabled:opacity-50">
          <Send className="h-4 w-4" aria-hidden /> Enviar prueba
        </button>
      </form>
    </div>
  );
}
