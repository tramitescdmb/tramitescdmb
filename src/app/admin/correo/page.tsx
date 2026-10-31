import Link from "next/link";
import { redirect } from "next/navigation";
import type { EstadoCorreo, Prisma } from "@prisma/client";
import { Mail, KeyRound, Plus, BellRing, History, Wrench, CheckCircle2, AlertTriangle, Play, RotateCcw, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { CabeceraTablero, Chip, type TonoTablero } from "@/components/tablero";
import { BotonConfirmar } from "@/components/admin/BotonConfirmar";
import { MatrizNotificaciones, type SeccionMatriz } from "@/components/admin/MatrizNotificaciones";
import { correoConfigurado, variablesEntornoCorreo } from "@/lib/correo-microsoft";
import {
  CATEGORIAS_AVISO,
  CLAVES_MATRIZ,
  correoDeUsuario,
  definicionAviso,
  esEventoAviso,
  EVENTOS_AVISO,
  MAX_INTENTOS,
  MODULOS_AVISO,
  parametros,
  partirClave,
  urlBasePlataforma,
  type ModuloAviso,
} from "@/lib/avisos-correo";
import { RETENCION_CUERPO_DIAS, RETENCION_REGISTRO_DIAS } from "@/lib/mantenimiento-correo";
import { formatearFechaHora } from "@/lib/fecha";

const CAMPO = "w-full rounded-md border border-stone-200 px-2.5 py-1.5 text-sm";
const BOTON = "inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50";
const BOTON_PRINCIPAL = "inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cdmb-700 disabled:opacity-50";
const DIA = 86_400_000;

const PESTANAS = [
  { id: "notificaciones", label: "Notificaciones", icono: BellRing },
  { id: "cuentas", label: "Cuentas", icono: KeyRound },
  { id: "envios", label: "Envíos", icono: History },
  { id: "mantenimiento", label: "Mantenimiento", icono: Wrench },
] as const;
type Pestana = (typeof PESTANAS)[number]["id"];

const FILTROS_ENVIO = [
  { id: "", label: "Todos" },
  { id: "ENVIADO", label: "Enviados" },
  { id: "COLA", label: "En cola" },
  { id: "FALLIDO", label: "Fallidos" },
  { id: "REBOTADO", label: "Rebotados" },
  { id: "OMITIDO", label: "Omitidos" },
  { id: "PRUEBA", label: "Pruebas" },
] as const;

const ESTADO_ENVIO: Record<EstadoCorreo, { texto: string; tono: TonoTablero }> = {
  EN_CURSO: { texto: "En curso", tono: "cielo" },
  REINTENTO: { texto: "En cola", tono: "ambar" },
  ENVIADO: { texto: "Enviado", tono: "verde" },
  FALLIDO: { texto: "Fallido", tono: "rojo" },
  REBOTADO: { texto: "Rebotado", tono: "violeta" },
  OMITIDO: { texto: "Omitido", tono: "neutro" },
};

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

function Requisito({ ok, children, titulo }: { ok: boolean | null; children: React.ReactNode; titulo?: string }) {
  const Icono = ok ? CheckCircle2 : AlertTriangle;
  const clase = ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : ok === null ? "border-stone-200 bg-stone-50 text-stone-600" : "border-amber-200 bg-amber-50 text-amber-800";
  return (
    <span title={titulo} className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${clase}`}>
      <Icono className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {children}
    </span>
  );
}

function Seccion({ titulo, icono: Icono, extra, children }: { titulo: string; icono: typeof Mail; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-stone-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
          <Icono className="h-4 w-4" aria-hidden /> {titulo}
        </p>
        {extra && <div className="ml-auto flex flex-wrap items-center gap-2">{extra}</div>}
      </div>
      <div className="border-t border-stone-100">{children}</div>
    </section>
  );
}

const TH = "px-2 py-2 font-medium";
const FILA_TH = "border-b border-stone-200 text-left text-[11px] uppercase tracking-wide text-stone-500";

async function usuariosSinCorreo() {
  const usuarios = await db.usuario.findMany({ where: { activo: true }, select: { id: true, nombre: true, email: true, correoNotificacion: true }, orderBy: { nombre: "asc" } });
  return usuarios.filter((u) => !correoDeUsuario(u));
}

export default async function CorreoInstitucionalPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; tab?: string; estado?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") return <AccesoRestringido titulo="Correo institucional" quien="administrador del sistema" volverHref="/" volverLabel="Ir al inicio" />;
  const sp = await searchParams;
  const pestana: Pestana = PESTANAS.some((p) => p.id === sp.tab) ? (sp.tab as Pestana) : "notificaciones";
  const [cuentas, ajustes, enCola, fallidos, suprimidas] = await Promise.all([
    db.cuentaCorreo.findMany({ orderBy: [{ predeterminada: "desc" }, { createdAt: "asc" }], include: { claves: { orderBy: { createdAt: "desc" } } } }),
    parametros(),
    db.correoEnviado.count({ where: { estado: { in: ["REINTENTO", "EN_CURSO"] } } }),
    db.correoEnviado.count({ where: { estado: "FALLIDO", createdAt: { gte: new Date(Date.now() - 7 * DIA) } } }),
    db.correoSuprimido.count(),
  ]);
  const ahora = Date.now();
  const entorno = cuentas.length === 0 ? variablesEntornoCorreo() : null;
  const contadores: Partial<Record<Pestana, number>> = { cuentas: cuentas.length, envios: enCola + fallidos || undefined, mantenimiento: suprimidas || undefined };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <CabeceraTablero
        icon={Mail}
        titulo="Correo institucional"
        descripcion="Envío de correos desde buzones @cdmb.gov.co de Microsoft 365 por Microsoft Graph, con el registro de aplicación del tenant (permiso de aplicación Mail.Send con consentimiento de administrador; Mail.ReadWrite para leer los rebotes). La matriz define qué notificaciones salen por correo en cada módulo; las que no se envían siguen visibles en la plataforma. Cada correo queda en el registro de envíos: los que fallan se reintentan, los que rebotan por dirección inexistente suprimen esa dirección y el mantenimiento diario depura el registro."
      />
      {sp.ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}
      {entorno && <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Sin cuentas registradas: se usa la configuración del servidor ({entorno}).</div>}

      <nav aria-label="Secciones del correo institucional" className="flex gap-0 overflow-x-auto rounded-md border border-stone-200 bg-white">
        {PESTANAS.map((p) => {
          const sel = p.id === pestana;
          const Icono = p.icono;
          return (
            <Link
              key={p.id}
              href={`/admin/correo?tab=${p.id}`}
              aria-current={sel ? "page" : undefined}
              className={`flex flex-none items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition-colors ${
                sel ? "border-b-cdmb-600 font-semibold text-stone-900" : "border-transparent text-stone-600 hover:bg-stone-50 hover:text-stone-900"
              }`}
            >
              <Icono className={`h-4 w-4 ${sel ? "text-cdmb-600" : "text-stone-400"}`} aria-hidden />
              {p.label}
              {contadores[p.id] !== undefined && <span className="rounded-sm bg-sky-100 px-1.5 text-[11px] font-semibold tabular-nums text-sky-800">{contadores[p.id]}</span>}
            </Link>
          );
        })}
      </nav>

      {pestana === "notificaciones" && <PestanaNotificaciones cuentas={cuentas} ajustes={ajustes} ahora={ahora} enCola={enCola} suprimidas={suprimidas} usuarioId={session.userId} />}
      {pestana === "cuentas" && <PestanaCuentas cuentas={cuentas} ahora={ahora} />}
      {pestana === "envios" && <PestanaEnvios filtro={sp.estado ?? ""} />}
      {pestana === "mantenimiento" && <PestanaMantenimiento cuentas={cuentas} />}
    </div>
  );
}

type CuentaConClaves = Prisma.CuentaCorreoGetPayload<{ include: { claves: true } }>;

async function PestanaNotificaciones({
  cuentas,
  ajustes,
  ahora,
  enCola,
  suprimidas,
  usuarioId,
}: {
  cuentas: CuentaConClaves[];
  ajustes: Awaited<ReturnType<typeof parametros>>;
  ahora: number;
  enCola: number;
  suprimidas: number;
  usuarioId: string;
}) {
  const [listo, sinCorreo, yo] = await Promise.all([correoConfigurado(), usuariosSinCorreo(), db.usuario.findUnique({ where: { id: usuarioId }, select: { email: true, correoNotificacion: true } })]);
  const urlEfectiva = urlBasePlataforma(ajustes.urlPlataforma);
  const principal = cuentas.find((c) => c.activa && c.claves.some((k) => k.activa && (!k.vence || k.vence.getTime() > ahora)));
  const venceClave = principal?.claves
    .filter((k) => k.activa && (!k.vence || k.vence.getTime() > ahora))
    .map((k) => k.vence)
    .reduce<Date | null | undefined>((max, v) => (v === null || max === null ? null : !max || v! > max ? v : max), undefined);
  const secciones: SeccionMatriz[] = (Object.keys(MODULOS_AVISO) as ModuloAviso[]).map((modulo) => ({
    modulo,
    nombre: MODULOS_AVISO[modulo],
    filas: CLAVES_MATRIZ.filter((c) => partirClave(c).modulo === modulo).map((clave) => {
      const def = definicionAviso(partirClave(clave).evento);
      return {
        clave,
        evento: def.evento,
        categoria: CATEGORIAS_AVISO[def.categoria],
        destinatarios: def.destinatarios,
        plataforma: def.plataforma,
        envio: def.diario ? `Diario, ${def.diario}` : "Inmediato",
      };
    }),
  }));

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-stone-200 bg-white px-4 py-3">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Preparación</span>
        <Requisito ok={listo && Boolean(principal)}>
          {principal ? `${principal.remitente} · clave ${venceClave ? `hasta ${fecha(venceClave)}` : "sin vencimiento"}` : "Sin cuenta con claves vigentes"}
        </Requisito>
        <Requisito ok={Boolean(urlEfectiva)}>{urlEfectiva ? `Enlaces a ${urlEfectiva.replace(/^https:\/\//, "")}` : "Sin dirección para los enlaces"}</Requisito>
        <Requisito ok={principal?.rebotesRevisionOk ?? null} titulo={principal?.rebotesMensaje ?? undefined}>
          {principal?.rebotesRevisionOk ? "Lectura de rebotes activa" : principal?.rebotesRevisionOk === false ? "Lectura de rebotes sin permiso" : "Lectura de rebotes sin verificar"}
        </Requisito>
        <Requisito ok={sinCorreo.length === 0} titulo={sinCorreo.map((u) => u.nombre).join(", ") || undefined}>
          {sinCorreo.length === 0 ? "Todos los usuarios activos con correo" : `${sinCorreo.length} usuario(s) activos sin correo`}
        </Requisito>
        {enCola > 0 && <Requisito ok={false}>{enCola} correo(s) en cola</Requisito>}
        {suprimidas > 0 && <Requisito ok={null}>{suprimidas} dirección(es) suprimidas</Requisito>}
      </div>
      <MatrizNotificaciones
        secciones={secciones}
        activosIniciales={[...ajustes.activos]}
        correoPrueba={ajustes.correoPrueba ?? (yo ? (correoDeUsuario(yo) ?? "") : "")}
        cuentas={cuentas.filter((c) => c.activa).map((c) => ({ id: c.id, etiqueta: `${c.nombre} · ${c.remitente}`, predeterminada: c.predeterminada }))}
        urlPlataforma={ajustes.urlPlataforma ?? ""}
        urlEfectiva={urlEfectiva}
      />
    </>
  );
}

function PestanaCuentas({ cuentas, ahora }: { cuentas: CuentaConClaves[]; ahora: number }) {
  return (
    <>
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
                      <tr className={FILA_TH}>
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
    </>
  );
}

function whereFiltro(filtro: string): Prisma.CorreoEnviadoWhereInput {
  if (filtro === "PRUEBA") return { clave: { startsWith: "prueba:" } };
  if (filtro === "COLA") return { estado: { in: ["REINTENTO", "EN_CURSO"] } };
  if (filtro in ESTADO_ENVIO) return { estado: filtro as EstadoCorreo };
  return {};
}

function nombreEvento(categoria: string, modulo: string | null) {
  const evento = esEventoAviso(categoria) ? EVENTOS_AVISO[categoria].evento : categoria;
  return { evento, modulo: modulo && modulo in MODULOS_AVISO ? MODULOS_AVISO[modulo as ModuloAviso] : null };
}

async function PestanaEnvios({ filtro }: { filtro: string }) {
  const [grupos, pruebas, envios, reintentables] = await Promise.all([
    db.correoEnviado.groupBy({ by: ["estado"], _count: true }),
    db.correoEnviado.count({ where: { clave: { startsWith: "prueba:" } } }),
    db.correoEnviado.findMany({ where: whereFiltro(filtro), orderBy: { createdAt: "desc" }, take: 80 }),
    db.correoEnviado.count({ where: { estado: "FALLIDO", html: { not: null }, NOT: { clave: { startsWith: "prueba:" } } } }),
  ]);
  const cuenta = (e: EstadoCorreo) => grupos.find((g) => g.estado === e)?._count ?? 0;
  const conteos: Record<string, number> = {
    "": grupos.reduce((n, g) => n + g._count, 0),
    ENVIADO: cuenta("ENVIADO"),
    COLA: cuenta("REINTENTO") + cuenta("EN_CURSO"),
    FALLIDO: cuenta("FALLIDO"),
    REBOTADO: cuenta("REBOTADO"),
    OMITIDO: cuenta("OMITIDO"),
    PRUEBA: pruebas,
  };

  return (
    <Seccion
      titulo="Registro de envíos"
      icono={History}
      extra={
        <>
          <form action="/api/admin/correo/envios" method="post">
            <input type="hidden" name="accion" value="procesar" />
            <button className={BOTON} disabled={conteos.COLA === 0}>
              <Play className="h-3.5 w-3.5" aria-hidden /> Procesar cola
            </button>
          </form>
          <form action="/api/admin/correo/envios" method="post">
            <input type="hidden" name="accion" value="reintentar" />
            <BotonConfirmar mensaje={`¿Volver a enviar ${reintentables} correo(s) fallido(s)?`} className={BOTON} disabled={reintentables === 0}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reintentar fallidos ({reintentables})
            </BotonConfirmar>
          </form>
          <form action="/api/admin/correo/envios" method="post">
            <input type="hidden" name="accion" value="descartar" />
            <BotonConfirmar mensaje="¿Descartar los correos en cola? No se enviarán." className={`${BOTON} text-red-700`} disabled={cuenta("REINTENTO") === 0}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Descartar la cola
            </BotonConfirmar>
          </form>
        </>
      }
    >
      <div className="flex flex-wrap gap-1.5 px-4 py-2.5">
        {FILTROS_ENVIO.map((f) => {
          const sel = f.id === filtro || (!FILTROS_ENVIO.some((x) => x.id === filtro) && f.id === "");
          return (
            <Link
              key={f.id}
              href={`/admin/correo?tab=envios${f.id ? `&estado=${f.id}` : ""}`}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${sel ? "border-cdmb-600 bg-cdmb-50 font-medium text-cdmb-800" : "border-stone-200 text-stone-600 hover:bg-stone-50"}`}
            >
              {f.label}
              <span className="tabular-nums text-stone-500">{conteos[f.id] ?? 0}</span>
            </Link>
          );
        })}
      </div>
      <div className="overflow-x-auto border-t border-stone-100">
        <table className="w-full text-sm">
          <thead>
            <tr className={FILA_TH}>
              <th className="px-4 py-2 font-medium">Fecha</th>
              <th className={TH}>Destinatario</th>
              <th className={`${TH} hidden md:table-cell`}>Notificación</th>
              <th className={TH}>Asunto</th>
              <th className={`${TH} text-center`}>Intentos</th>
              <th className="px-4 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {envios.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-3 text-xs text-stone-500">Sin envíos en este filtro.</td>
              </tr>
            )}
            {envios.map((x) => {
              const { evento, modulo } = nombreEvento(x.categoria, x.modulo);
              const estado = ESTADO_ENVIO[x.estado];
              const detalle = x.estado === "REBOTADO" ? x.rebote : x.estado === "ENVIADO" ? null : x.error;
              return (
                <tr key={x.id} className="border-b border-stone-100 align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-1.5 text-xs text-stone-600">{formatearFechaHora(x.createdAt)}</td>
                  <td className="px-2 py-1.5 text-xs">{x.destinatario}</td>
                  <td className="hidden px-2 py-1.5 text-xs text-stone-600 md:table-cell">
                    {evento}
                    {modulo && <span className="block text-[11px] text-stone-400">{modulo}</span>}
                  </td>
                  <td className="px-2 py-1.5 text-xs text-stone-600">
                    {x.clave.startsWith("prueba:") && <span className="mr-1"><Chip tono="acento">Prueba</Chip></span>}
                    {x.asunto}
                  </td>
                  <td className="px-2 py-1.5 text-center text-xs tabular-nums text-stone-600">{x.intentos}</td>
                  <td className="px-4 py-1.5 text-xs">
                    <Chip tono={estado.tono}>{estado.texto}</Chip>
                    {x.estado === "REINTENTO" && x.proximoIntento && <span className="block text-[11px] text-stone-500">Próximo: {formatearFechaHora(x.proximoIntento)}</span>}
                    {detalle && (
                      <span className="block max-w-64 truncate text-[11px] text-stone-500" title={detalle}>
                        {detalle}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-stone-100 px-4 py-2 text-[11px] text-stone-500">
        Hasta {MAX_INTENTOS} intentos en 3 días · registro de {RETENCION_REGISTRO_DIAS} días · contenido de los fallidos por {RETENCION_CUERPO_DIAS} días
      </p>
    </Seccion>
  );
}

type ResumenMantenimiento = {
  cola?: { enviados?: number; reprogramados?: number; fallidos?: number; caducados?: number; liberados?: number; error?: string };
  rebotes?: { cuenta: string; marcados: number; suprimidas: number; ok: boolean; mensaje?: string }[] | { error: string };
  limpieza?: { registrosBorrados?: number; cuerposDepurados?: number; error?: string };
  administrador?: { alertas?: number; correos?: number; motivo?: string; error?: string };
};

function leerResumen(texto: string | null): ResumenMantenimiento | null {
  if (!texto) return null;
  try {
    return JSON.parse(texto) as ResumenMantenimiento;
  } catch {
    return null;
  }
}

async function PestanaMantenimiento({ cuentas }: { cuentas: CuentaConClaves[] }) {
  const [ultima, lista, sinCorreo] = await Promise.all([
    db.ejecucionProceso.findFirst({ where: { proceso: "mantenimiento-correo" }, orderBy: { inicio: "desc" } }),
    db.correoSuprimido.findMany({ orderBy: { ultimoEn: "desc" }, take: 200 }),
    usuariosSinCorreo(),
  ]);
  const usuarios = lista.length
    ? await db.usuario.findMany({
        where: { OR: [{ correoNotificacion: { in: lista.map((s) => s.correo) } }, { email: { in: lista.map((s) => s.correo) } }] },
        select: { id: true, nombre: true, email: true, correoNotificacion: true },
      })
    : [];
  const resumen = leerResumen(ultima?.resumen ?? null);
  const rebotes = Array.isArray(resumen?.rebotes) ? resumen.rebotes : null;
  const acciones: { nombre: string; que: string; resultado: string }[] = [
    {
      nombre: "Rebotes del buzón",
      que: "Lee los informes de no entrega, marca el envío como rebotado, suprime la dirección si no existe y mueve el informe a elementos eliminados.",
      resultado: rebotes
        ? rebotes.map((r) => (r.ok ? `${r.cuenta}: ${r.marcados} marcado(s), ${r.suprimidas} suprimida(s)` : `${r.cuenta}: ${r.mensaje}`)).join(" · ") || "Sin cuentas activas"
        : resumen?.rebotes && "error" in resumen.rebotes
          ? `Error: ${resumen.rebotes.error}`
          : "—",
    },
    {
      nombre: "Cola de envío",
      que: `Reintenta los correos que no salieron (hasta ${MAX_INTENTOS} intentos en 3 días) y libera los que quedaron en curso.`,
      resultado: resumen?.cola
        ? resumen.cola.error
          ? `Error: ${resumen.cola.error}`
          : `${resumen.cola.enviados ?? 0} enviado(s), ${resumen.cola.reprogramados ?? 0} reprogramado(s), ${(resumen.cola.fallidos ?? 0) + (resumen.cola.caducados ?? 0)} descartado(s)`
        : "—",
    },
    {
      nombre: "Depuración del registro",
      que: `Borra los envíos de más de ${RETENCION_REGISTRO_DIAS} días y el contenido de los mensajes ya resueltos.`,
      resultado: resumen?.limpieza
        ? resumen.limpieza.error
          ? `Error: ${resumen.limpieza.error}`
          : `${resumen.limpieza.registrosBorrados ?? 0} registro(s) borrados, ${resumen.limpieza.cuerposDepurados ?? 0} contenido(s) depurados`
        : "—",
    },
    {
      nombre: "Aviso al administrador",
      que: "Envía a los administradores las direcciones suprimidas, los envíos descartados y las claves por vencer, según la matriz.",
      resultado: resumen?.administrador
        ? (resumen.administrador.error ?? resumen.administrador.motivo ?? `${resumen.administrador.alertas ?? 0} novedad(es), ${resumen.administrador.correos ?? 0} correo(s)`)
        : "—",
    },
  ];

  return (
    <>
      <Seccion
        titulo="Acciones automáticas"
        icono={Wrench}
        extra={
          <>
            <span className="text-xs text-stone-500">
              Todos los días, 7:00 a. m. · {ultima ? `última: ${formatearFechaHora(ultima.inicio)}${ultima.ok === false ? " (con error)" : ""}` : "sin ejecuciones"}
            </span>
            <form action="/api/correo/mantenimiento" method="post">
              <input type="hidden" name="volver" value="/admin/correo" />
              <button className={BOTON}>
                <Play className="h-3.5 w-3.5" aria-hidden /> Ejecutar ahora
              </button>
            </form>
          </>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={FILA_TH}>
                <th className="px-4 py-2 font-medium">Acción</th>
                <th className={`${TH} hidden md:table-cell`}>Qué hace</th>
                <th className="px-4 py-2 font-medium">Última ejecución</th>
              </tr>
            </thead>
            <tbody>
              {acciones.map((a) => (
                <tr key={a.nombre} className="border-b border-stone-100 align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-1.5 text-sm font-medium text-stone-800">{a.nombre}</td>
                  <td className="hidden px-2 py-1.5 text-xs text-stone-600 md:table-cell">{a.que}</td>
                  <td className="px-4 py-1.5 text-xs text-stone-600">{a.resultado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="overflow-x-auto border-t border-stone-100">
          <table className="w-full text-sm">
            <thead>
              <tr className={FILA_TH}>
                <th className="px-4 py-2 font-medium">Buzón</th>
                <th className={TH}>Revisado hasta</th>
                <th className="px-4 py-2 font-medium">Lectura de rebotes</th>
              </tr>
            </thead>
            <tbody>
              {cuentas.filter((c) => c.activa).map((c) => (
                <tr key={c.id} className="border-b border-stone-100 align-top last:border-0">
                  <td className="px-4 py-1.5 text-xs">{c.remitente}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-xs text-stone-600">{c.rebotesHasta ? formatearFechaHora(c.rebotesHasta) : "—"}</td>
                  <td className="px-4 py-1.5 text-xs">
                    {c.rebotesRevisionAt ? (
                      <span className={c.rebotesRevisionOk ? "text-emerald-700" : "text-red-700"}>{c.rebotesMensaje}</span>
                    ) : (
                      <span className="text-stone-500">Sin revisar</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion
        titulo="Direcciones suprimidas"
        icono={AlertTriangle}
        extra={<span className="text-xs text-stone-500">{lista.length} dirección(es) que no reciben correos de la plataforma</span>}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={FILA_TH}>
                <th className="px-4 py-2 font-medium">Correo</th>
                <th className={TH}>Usuario</th>
                <th className={TH}>Motivo</th>
                <th className={`${TH} text-center`}>Rebotes</th>
                <th className={TH}>Último</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-xs text-stone-500">Ninguna dirección suprimida.</td>
                </tr>
              )}
              {lista.map((s) => {
                const quien = usuarios.find((u) => (u.correoNotificacion ?? u.email).toLowerCase() === s.correo);
                return (
                  <tr key={s.correo} className="border-b border-stone-100 align-top last:border-0">
                    <td className="px-4 py-1.5 text-xs font-medium">{s.correo}</td>
                    <td className="px-2 py-1.5 text-xs">
                      {quien ? (
                        <Link href={`/usuarios/${quien.id}`} className="text-cdmb-700 hover:underline">{quien.nombre}</Link>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="max-w-80 px-2 py-1.5 text-xs text-stone-600">
                      <span className="line-clamp-2" title={s.motivo}>
                        {s.codigo && <span className="mr-1 font-mono">{s.codigo}</span>}
                        {s.motivo}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center text-xs tabular-nums">{s.rebotes}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-xs text-stone-600">{formatearFechaHora(s.ultimoEn)}</td>
                    <td className="px-4 py-1.5 text-right">
                      <form action="/api/admin/correo/suprimidas" method="post">
                        <input type="hidden" name="accion" value="quitar" />
                        <input type="hidden" name="correo" value={s.correo} />
                        <BotonConfirmar mensaje={`¿Volver a enviar correos a ${s.correo}?`} className={BOTON}>Quitar</BotonConfirmar>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <form action="/api/admin/correo/suprimidas" method="post" className="flex flex-wrap items-end gap-2 border-t border-stone-100 px-4 py-3">
          <input type="hidden" name="accion" value="agregar" />
          <label className="min-w-56 flex-1 text-sm">
            <span className="mb-1 block text-xs text-stone-500">Correo</span>
            <input name="correo" type="email" required className={CAMPO} />
          </label>
          <label className="min-w-56 flex-[2] text-sm">
            <span className="mb-1 block text-xs text-stone-500">Motivo</span>
            <input name="motivo" placeholder="Ej. Buzón cerrado por retiro" className={CAMPO} />
          </label>
          <button type="submit" className={BOTON}>Suprimir dirección</button>
        </form>
      </Seccion>

      <Seccion titulo="Usuarios activos sin correo de notificación" icono={Mail} extra={<span className="text-xs text-stone-500">{sinCorreo.length} usuario(s)</span>}>
        {sinCorreo.length === 0 ? (
          <p className="px-4 py-3 text-xs text-stone-500">Todos los usuarios activos tienen un correo válido.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5 px-4 py-3">
            {sinCorreo.map((u) => (
              <li key={u.id}>
                <Link href={`/usuarios/${u.id}`} className="inline-flex rounded-full border border-stone-200 px-2.5 py-0.5 text-xs text-stone-700 hover:bg-stone-50">
                  {u.nombre} <span className="ml-1 text-stone-400">{u.email}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Seccion>
    </>
  );
}
