import { redirect } from "next/navigation";
import { Mail, KeyRound, Plus, Send, BellRing, History } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { CabeceraTablero } from "@/components/tablero";
import { BotonConfirmar } from "@/components/admin/BotonConfirmar";
import { MarcarCasillas } from "@/components/admin/MarcarCasillas";
import { correoConfigurado, variablesEntornoCorreo } from "@/lib/correo-microsoft";
import { EVENTOS_AVISO, GRUPOS_AVISO, parametros, urlBasePlataforma, esEventoAviso, type EventoAviso, type GrupoAviso } from "@/lib/avisos-correo";

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
  const [cuentas, usuario, listo, ajustes, envios] = await Promise.all([
    db.cuentaCorreo.findMany({ orderBy: [{ predeterminada: "desc" }, { createdAt: "asc" }], include: { claves: { orderBy: { createdAt: "desc" } } } }),
    db.usuario.findUnique({ where: { id: session.userId }, select: { correoNotificacion: true } }),
    correoConfigurado(),
    parametros(),
    db.correoEnviado.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const eventos = Object.entries(EVENTOS_AVISO) as [EventoAviso, (typeof EVENTOS_AVISO)[EventoAviso]][];
  const urlEfectiva = urlBasePlataforma(ajustes.urlPlataforma);
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
                <div className="overflow-x-auto">
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
                </div>
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

      <form id="matriz" action="/api/admin/correo/avisos" method="post" className="rounded-md border border-stone-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
            <BellRing className="h-4 w-4" aria-hidden /> Matriz de notificaciones
          </p>
          <span className="text-xs text-stone-500">
            {eventos.filter(([k]) => !ajustes.desactivados.has(k)).length} de {eventos.length} eventos se envían por correo
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <MarcarCasillas formulario="matriz" etiqueta="Seleccionar:" />
            <button type="submit" className={BOTON_PRINCIPAL}>Guardar matriz</button>
          </div>
        </div>
        <div className="overflow-x-auto border-t border-stone-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-[11px] uppercase tracking-wide text-stone-500">
                <th className="px-4 py-2 font-medium">Evento</th>
                <th className="hidden px-2 py-2 font-medium md:table-cell">Módulo</th>
                <th className="hidden px-2 py-2 font-medium sm:table-cell">Destinatarios</th>
                <th className="hidden px-2 py-2 font-medium md:table-cell">Siempre visible en</th>
                <th className="px-4 py-2 text-center font-medium">Enviar por correo</th>
              </tr>
            </thead>
            {(Object.keys(GRUPOS_AVISO) as GrupoAviso[]).map((g) => (
              <tbody key={g}>
                <tr className="bg-stone-50">
                  <td colSpan={5} className="px-4 py-1.5 text-xs font-semibold text-stone-700">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>
                        {GRUPOS_AVISO[g]}
                        {g === "VENCIMIENTOS" && <span className="ml-1.5 font-normal text-stone-500">· proceso diario, 7:30 a. m.</span>}
                      </span>
                      <span className="ml-auto">
                        <MarcarCasillas formulario="matriz" grupo={g} />
                      </span>
                    </div>
                  </td>
                </tr>
                {eventos
                  .filter(([, e]) => e.grupo === g)
                  .map(([clave, e]) => (
                    <tr key={clave} className="border-b border-stone-100 last:border-0">
                      <td className="px-4 py-1.5">
                        <label htmlFor={`evento-${clave}`} className="cursor-pointer">{e.evento}</label>
                        <span className="block text-[11px] text-stone-500 sm:hidden">{e.destinatarios}</span>
                      </td>
                      <td className="hidden px-2 py-1.5 text-xs text-stone-600 md:table-cell">{e.modulo}</td>
                      <td className="hidden px-2 py-1.5 text-xs text-stone-600 sm:table-cell">{e.destinatarios}</td>
                      <td className="hidden px-2 py-1.5 text-xs text-stone-500 md:table-cell">{e.plataforma}</td>
                      <td className="px-4 py-1.5">
                        <label className="flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap">
                          <input
                            id={`evento-${clave}`}
                            type="checkbox"
                            name="evento"
                            value={clave}
                            data-grupo={e.grupo}
                            defaultChecked={!ajustes.desactivados.has(clave)}
                            className="peer sr-only"
                          />
                          <span className="relative h-5 w-9 shrink-0 rounded-full bg-stone-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-cdmb-600 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-cdmb-300" />
                          <span className="w-20 text-xs text-stone-500 peer-checked:hidden">No se envía</span>
                          <span className="hidden w-20 text-xs font-medium text-cdmb-700 peer-checked:inline">Se envía</span>
                        </label>
                      </td>
                    </tr>
                  ))}
              </tbody>
            ))}
          </table>
        </div>
        <div className="flex flex-wrap items-end gap-2 border-t border-stone-100 px-4 py-3">
          <label className="min-w-72 flex-1 text-sm">
            <span className="mb-1 block text-xs text-stone-500">Dirección de la plataforma para los enlaces de los correos</span>
            <input name="urlPlataforma" defaultValue={ajustes.urlPlataforma ?? ""} placeholder={urlEfectiva ?? "https://tramites.cdmb.gov.co"} className={CAMPO} />
          </label>
          <span className="pb-2 text-xs text-stone-500">{urlEfectiva ? `En uso: ${urlEfectiva}` : "Sin dirección: los correos salen sin enlace."}</span>
        </div>
      </form>

      <details className="rounded-md border border-stone-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-4 py-3 text-sm font-semibold text-stone-900">
          <History className="h-4 w-4" aria-hidden /> Últimos envíos
          <span className="text-xs font-normal text-stone-500">· {envios.filter((x) => !x.ok).length} fallido(s) de {envios.length}</span>
        </summary>
        <div className="overflow-x-auto border-t border-stone-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-[11px] uppercase tracking-wide text-stone-500">
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-2 py-2 font-medium">Destinatario</th>
                <th className="px-2 py-2 font-medium">Evento</th>
                <th className="px-2 py-2 font-medium">Asunto</th>
                <th className="px-4 py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {envios.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-xs text-stone-500">Sin envíos registrados.</td>
                </tr>
              )}
              {envios.map((x) => (
                <tr key={x.id} className="border-b border-stone-100 last:border-0">
                  <td className="whitespace-nowrap px-4 py-1.5 text-xs text-stone-600">
                    {x.createdAt.toLocaleString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-2 py-1.5 text-xs">{x.destinatario}</td>
                  <td className="px-2 py-1.5 text-xs text-stone-600">{esEventoAviso(x.categoria) ? EVENTOS_AVISO[x.categoria].evento : x.categoria}</td>
                  <td className="px-2 py-1.5 text-xs text-stone-600">{x.asunto}</td>
                  <td className={`px-4 py-1.5 text-xs ${x.ok ? "text-emerald-700" : "text-red-700"}`} title={x.error ?? undefined}>
                    {x.ok ? "Enviado" : "Fallido"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
