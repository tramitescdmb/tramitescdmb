import { redirect } from "next/navigation";
import { Mail, KeyRound, Plus, Send } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { CabeceraTablero } from "@/components/tablero";
import { BotonConfirmar } from "@/components/admin/BotonConfirmar";
import { correoConfigurado, variablesEntornoCorreo } from "@/lib/correo-microsoft";

const CAMPO = "w-full rounded-md border border-stone-200 px-2.5 py-1.5 text-sm";
const BOTON = "rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50";
const BOTON_PRINCIPAL = "inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cdmb-700 disabled:opacity-50";
const DIA = 86_400_000;

function fecha(d: Date) {
  return d.toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "short", year: "numeric" });
}

function Etiqueta({ texto, children }: { texto: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs text-stone-500">{texto}</span>
      {children}
    </label>
  );
}

function CamposCuenta({ valor }: { valor?: { nombre: string; tenantId: string; clientId: string; remitente: string } }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Etiqueta texto="Nombre">
        <input name="nombre" required defaultValue={valor?.nombre} placeholder="Ej. Notificaciones de la plataforma" className={CAMPO} />
      </Etiqueta>
      <Etiqueta texto="Buzón remitente">
        <input name="remitente" type="email" required defaultValue={valor?.remitente} placeholder="sistemas@cdmb.gov.co" className={CAMPO} />
      </Etiqueta>
      <Etiqueta texto="Id. de directorio (tenant)">
        <input name="tenantId" required defaultValue={valor?.tenantId} placeholder="00000000-0000-0000-0000-000000000000" className={`${CAMPO} font-mono text-xs`} />
      </Etiqueta>
      <Etiqueta texto="Id. de aplicación (cliente)">
        <input name="clientId" required defaultValue={valor?.clientId} placeholder="00000000-0000-0000-0000-000000000000" className={`${CAMPO} font-mono text-xs`} />
      </Etiqueta>
    </div>
  );
}

function CamposClave() {
  return (
    <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
      <Etiqueta texto="Valor del secreto de cliente">
        <input name="secreto" type="password" required autoComplete="new-password" className={`${CAMPO} font-mono text-xs`} />
      </Etiqueta>
      <Etiqueta texto="Descripción">
        <input name="descripcion" placeholder="Ej. Clave 2026" className={CAMPO} />
      </Etiqueta>
      <Etiqueta texto="Vence">
        <input name="vence" type="date" className={CAMPO} />
      </Etiqueta>
    </div>
  );
}

export default async function CorreoInstitucionalPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") return <AccesoRestringido titulo="Correo institucional" quien="administrador del sistema" volverHref="/" volverLabel="Ir al inicio" />;
  const sp = await searchParams;
  const [cuentas, usuario, listo] = await Promise.all([
    db.cuentaCorreo.findMany({ orderBy: [{ predeterminada: "desc" }, { createdAt: "asc" }], include: { claves: { orderBy: { createdAt: "desc" } } } }),
    db.usuario.findUnique({ where: { id: session.userId }, select: { correoNotificacion: true } }),
    correoConfigurado(),
  ]);
  const entorno = cuentas.length === 0 ? variablesEntornoCorreo() : null;
  const ahora = Date.now();

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <CabeceraTablero
        icon={Mail}
        titulo="Correo institucional"
        contador={cuentas.length}
        descripcion="Envío de correos desde buzones @cdmb.gov.co de Microsoft 365 por Microsoft Graph, con el registro de aplicación del tenant (permiso de aplicación Mail.Send con consentimiento de administrador). Cada cuenta reúne el tenant, la aplicación y el buzón remitente; puede tener varias claves (secretos de cliente) para cambiarlas antes de que venzan: se usa la más reciente vigente y, si Microsoft la rechaza, la siguiente. Los secretos se guardan cifrados y no vuelven a mostrarse. No usa contraseñas de usuarios ni modifica la autenticación multifactor."
      />
      {sp.ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}
      {entorno && <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Sin cuentas registradas: se usa la configuración del servidor ({entorno}).</div>}

      {cuentas.map((c) => {
        const vigentes = c.claves.filter((k) => k.activa && (!k.vence || k.vence.getTime() > ahora));
        return (
          <details key={c.id} open={c.predeterminada} className="rounded-md border border-stone-200 bg-white">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3 text-sm">
              <span className="font-semibold text-stone-900">{c.nombre}</span>
              <span className="text-stone-500">{c.remitente}</span>
              {c.predeterminada && <span className="rounded-full bg-cdmb-50 px-2 py-0.5 text-[11px] font-medium text-cdmb-700">Predeterminada</span>}
              {!c.activa && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600">Inactiva</span>}
              {vigentes.length === 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] text-red-700">Sin claves vigentes</span>}
              <span className="ml-auto text-xs text-stone-500">
                {c.ultimaPruebaAt ? (
                  <span className={c.ultimaPruebaOk ? "text-emerald-700" : "text-red-700"} title={c.ultimaPruebaMensaje ?? undefined}>
                    Prueba {c.ultimaPruebaOk ? "correcta" : "fallida"} · {fecha(c.ultimaPruebaAt)}
                  </span>
                ) : (
                  "Sin probar"
                )}
              </span>
            </summary>

            <div className="space-y-4 border-t border-stone-100 px-4 py-3">
              <form action="/api/admin/correo/cuentas" method="post" className="space-y-2">
                <input type="hidden" name="accion" value="editar" />
                <input type="hidden" name="cuentaId" value={c.id} />
                <CamposCuenta valor={c} />
                <div className="flex flex-wrap gap-1.5">
                  <button type="submit" className={BOTON}>Guardar cambios</button>
                </div>
              </form>

              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  <KeyRound className="h-3.5 w-3.5" aria-hidden /> Claves
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-left text-[11px] uppercase tracking-wide text-stone-500">
                      <th className="py-1.5 pr-2 font-medium">Clave</th>
                      <th className="px-2 py-1.5 font-medium">Descripción</th>
                      <th className="px-2 py-1.5 font-medium">Registrada</th>
                      <th className="px-2 py-1.5 font-medium">Vence</th>
                      <th className="px-2 py-1.5 font-medium">Estado</th>
                      <th className="py-1.5 pl-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {c.claves.map((k) => {
                      const vencida = Boolean(k.vence && k.vence.getTime() <= ahora);
                      const porVencer = Boolean(k.vence && !vencida && k.vence.getTime() - ahora < 30 * DIA);
                      return (
                        <tr key={k.id} className="border-b border-stone-100 last:border-0">
                          <td className="py-1.5 pr-2 font-mono text-xs">••••{k.final}</td>
                          <td className="px-2 py-1.5 text-stone-600">{k.descripcion ?? "—"}</td>
                          <td className="px-2 py-1.5 text-xs text-stone-600">{fecha(k.createdAt)}</td>
                          <td className={`px-2 py-1.5 text-xs ${vencida ? "text-red-700" : porVencer ? "text-amber-700" : "text-stone-600"}`}>{k.vence ? fecha(k.vence) : "—"}</td>
                          <td className="px-2 py-1.5 text-xs">{vencida ? "Vencida" : k.activa ? "Activa" : "Inactiva"}</td>
                          <td className="py-1.5 pl-2">
                            <div className="flex justify-end gap-1">
                              <form action="/api/admin/correo/cuentas" method="post">
                                <input type="hidden" name="accion" value={k.activa ? "desactivar_clave" : "activar_clave"} />
                                <input type="hidden" name="cuentaId" value={c.id} />
                                <input type="hidden" name="claveId" value={k.id} />
                                <button type="submit" className={BOTON}>{k.activa ? "Desactivar" : "Activar"}</button>
                              </form>
                              <form action="/api/admin/correo/cuentas" method="post">
                                <input type="hidden" name="accion" value="eliminar_clave" />
                                <input type="hidden" name="cuentaId" value={c.id} />
                                <input type="hidden" name="claveId" value={k.id} />
                                <BotonConfirmar mensaje={`¿Eliminar la clave ••••${k.final}?`} className={BOTON}>Eliminar</BotonConfirmar>
                              </form>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <form action="/api/admin/correo/cuentas" method="post" className="mt-2 space-y-2 rounded-md bg-stone-50 p-3">
                  <input type="hidden" name="accion" value="agregar_clave" />
                  <input type="hidden" name="cuentaId" value={c.id} />
                  <CamposClave />
                  <button type="submit" className={BOTON}>Agregar clave</button>
                </form>
              </div>

              <div className="flex flex-wrap gap-1.5 border-t border-stone-100 pt-3">
                {!c.predeterminada && (
                  <form action="/api/admin/correo/cuentas" method="post">
                    <input type="hidden" name="accion" value="predeterminar" />
                    <input type="hidden" name="cuentaId" value={c.id} />
                    <button type="submit" className={BOTON}>Usar como predeterminada</button>
                  </form>
                )}
                <form action="/api/admin/correo/cuentas" method="post">
                  <input type="hidden" name="accion" value={c.activa ? "desactivar" : "activar"} />
                  <input type="hidden" name="cuentaId" value={c.id} />
                  <button type="submit" className={BOTON}>{c.activa ? "Desactivar cuenta" : "Activar cuenta"}</button>
                </form>
                <form action="/api/admin/correo/cuentas" method="post">
                  <input type="hidden" name="accion" value="eliminar" />
                  <input type="hidden" name="cuentaId" value={c.id} />
                  <BotonConfirmar mensaje={`¿Eliminar la cuenta «${c.nombre}» y sus claves?`} className={`${BOTON} text-red-700`}>
                    Eliminar cuenta
                  </BotonConfirmar>
                </form>
              </div>
            </div>
          </details>
        );
      })}

      <details open={cuentas.length === 0} className="rounded-md border border-stone-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-4 py-3 text-sm font-semibold text-stone-900">
          <Plus className="h-4 w-4" aria-hidden /> Agregar cuenta
        </summary>
        <form action="/api/admin/correo/cuentas" method="post" className="space-y-2 border-t border-stone-100 px-4 py-3">
          <input type="hidden" name="accion" value="crear" />
          <CamposCuenta />
          <CamposClave />
          <button type="submit" className={BOTON_PRINCIPAL}>Registrar cuenta</button>
        </form>
      </details>

      <form action="/api/admin/correo/prueba" method="post" className="flex flex-wrap items-end gap-2 rounded-md border border-stone-200 bg-white p-4">
        {cuentas.length > 0 && (
          <label className="text-sm">
            <span className="mb-1 block text-xs text-stone-500">Cuenta</span>
            <select name="cuentaId" defaultValue={cuentas.find((c) => c.predeterminada)?.id ?? cuentas[0]!.id} className={CAMPO}>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} · {c.remitente}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="min-w-64 flex-1 text-sm">
          <span className="mb-1 block text-xs text-stone-500">Enviar un correo de prueba a</span>
          <input name="destino" type="email" defaultValue={usuario?.correoNotificacion ?? ""} placeholder="nombre@cdmb.gov.co" className={CAMPO} />
        </label>
        <button disabled={!listo && cuentas.length === 0} className={BOTON_PRINCIPAL}>
          <Send className="h-4 w-4" aria-hidden /> Enviar prueba
        </button>
      </form>
    </div>
  );
}
