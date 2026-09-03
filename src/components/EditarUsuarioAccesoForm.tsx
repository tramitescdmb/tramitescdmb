"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Briefcase, Layers, Eye, EyeOff, UserRound, KeyRound, Copy, Check, RefreshCw } from "lucide-react";

type Opcion = { id: string; nombre: string };
type TramiteOpcion = { id: string; codigo: string; nombre: string };
type Grupo = { etiqueta: string; claseBadge: string; claseBarra: string; items: TramiteOpcion[] };
type Nivel = "VER" | "EDITAR";
type Seccion = "VITAL_BASE" | "VITAL_DASHBOARD" | "SINCA_BASE" | "SINCA_DASHBOARD" | "SINCA_MINERIA";

const BOTON_BASE = "flex-1 rounded-md border px-2 py-1 text-[11px] font-medium transition";

const SECCIONES_VITAL: { valor: Seccion; etiqueta: string; ayuda: string }[] = [
  { valor: "VITAL_BASE", etiqueta: "Solicitudes y Recientes", ayuda: "Ver las solicitudes de VITAL y las últimas radicadas." },
  { valor: "VITAL_DASHBOARD", etiqueta: "Dashboard", ayuda: "Ver las estadísticas e indicadores de VITAL." },
];
const SECCIONES_SINCA: { valor: Seccion; etiqueta: string; ayuda: string }[] = [
  { valor: "SINCA_BASE", etiqueta: "Solicitudes", ayuda: "Ver el histórico de solicitudes de SINCA 1.0." },
  { valor: "SINCA_DASHBOARD", etiqueta: "Dashboard", ayuda: "Ver las estadísticas e indicadores de SINCA 1.0." },
  { valor: "SINCA_MINERIA", etiqueta: "Minería de datos", ayuda: "Sección sensible: reservada para directivos, no para cualquier funcionario." },
];

const NAV_SECCIONES: { id: string; etiqueta: string }[] = [
  { id: "seccion-nombre", etiqueta: "Nombre" },
  { id: "seccion-rol", etiqueta: "Rol" },
  { id: "seccion-cargos", etiqueta: "Cargos" },
  { id: "seccion-contrasena", etiqueta: "Contraseña" },
  { id: "seccion-lectura", etiqueta: "VITAL y SINCA 1.0" },
  { id: "seccion-tramites", etiqueta: "Trámites" },
];

function generarContrasena(): string {
  const mayus = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const minus = "abcdefghijkmnpqrstuvwxyz";
  const numeros = "23456789";
  const simbolos = "!@#$%&*";
  const azar = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  const base = [azar(mayus), azar(minus), azar(numeros), azar(simbolos)];
  const todos = mayus + minus + numeros + simbolos;
  while (base.length < 12) base.push(azar(todos));
  for (let i = base.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base.join("");
}

function EncabezadoSeccion({ icono: Icono, titulo, ayuda }: { icono: typeof ShieldCheck; titulo: string; ayuda?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span
        className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-cdmb-100 text-cdmb-700"
        title={ayuda}
      >
        <Icono className="h-4 w-4" aria-hidden />
      </span>
      <span className="text-sm font-semibold text-stone-900">{titulo}</span>
    </div>
  );
}

/** Pastilla compacta para atajos "marcar/quitar todo" — más visible que un enlace de texto plano. */
function BotonAtajo({
  onClick,
  tono,
  title,
  children,
}: {
  onClick: () => void;
  tono: "activar" | "desactivar" | "ver";
  title?: string;
  children: React.ReactNode;
}) {
  const clases = {
    activar: "border-cdmb-200 bg-cdmb-50 text-cdmb-700 hover:border-cdmb-300 hover:bg-cdmb-100",
    desactivar: "border-stone-200 bg-stone-50 text-stone-500 hover:bg-stone-100",
    ver: "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100",
  }[tono];
  return (
    <button type="button" onClick={onClick} title={title} className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${clases}`}>
      {children}
    </button>
  );
}

export function EditarUsuarioAccesoForm({
  usuarioId,
  nombreActual,
  directorioActivo,
  rolActual,
  cargoActualIds,
  accesoActual,
  seccionesActuales,
  cargos,
  tramitesPorCategoria,
}: {
  usuarioId: string;
  nombreActual: string;
  directorioActivo: boolean;
  rolActual: "ADMIN" | "FUNCIONARIO";
  cargoActualIds: string[];
  accesoActual: { tramiteTipoId: string; nivel: Nivel }[];
  seccionesActuales: Seccion[];
  cargos: Opcion[];
  tramitesPorCategoria: Grupo[];
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState(nombreActual);
  const [rol, setRol] = useState(rolActual);
  const [cargoIds, setCargoIds] = useState<Set<string>>(new Set(cargoActualIds));
  const [acceso, setAcceso] = useState<Map<string, Nivel>>(new Map(accesoActual.map((a) => [a.tramiteTipoId, a.nivel])));
  const [secciones, setSecciones] = useState<Set<Seccion>>(new Set(seccionesActuales));
  const [nuevaContrasena, setNuevaContrasena] = useState("");
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function alternarCargo(id: string) {
    setCargoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function alternarSeccion(s: Seccion) {
    setSecciones((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function marcarSecciones(valores: Seccion[], marcar: boolean) {
    setSecciones((prev) => {
      const next = new Set(prev);
      for (const v of valores) {
        if (marcar) next.add(v);
        else next.delete(v);
      }
      return next;
    });
  }

  function ponerNivel(tramiteId: string, nivel: Nivel | null) {
    setAcceso((prev) => {
      const next = new Map(prev);
      if (nivel === null) next.delete(tramiteId);
      else next.set(tramiteId, nivel);
      return next;
    });
  }

  function aplicarACategoria(items: TramiteOpcion[], nivel: Nivel | null) {
    setAcceso((prev) => {
      const next = new Map(prev);
      for (const t of items) {
        if (nivel === null) next.delete(t.id);
        else next.set(t.id, nivel);
      }
      return next;
    });
  }

  async function copiarContrasena() {
    if (!nuevaContrasena) return;
    try {
      await navigator.clipboard.writeText(nuevaContrasena);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError("No se pudo copiar automáticamente. Selecciónela y copie con Ctrl+C.");
    }
  }

  const totalConAcceso = acceso.size;
  const todosLosTramites = tramitesPorCategoria.flatMap((g) => g.items);

  async function guardar() {
    if (!nombre.trim()) {
      setError("Debe indicarse el nombre completo.");
      return;
    }
    if (nuevaContrasena && nuevaContrasena.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setGuardando(true);
    setError(null);
    setOk(false);
    try {
      const res = await fetch(`/api/usuarios/${usuarioId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          rol,
          cargoIds: Array.from(cargoIds),
          accesoTramites: Array.from(acceso.entries()).map(([tramiteTipoId, nivel]) => ({ tramiteTipoId, nivel })),
          secciones: Array.from(secciones),
          ...(nuevaContrasena ? { password: nuevaContrasena } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "No se pudo guardar.");
      }
      setOk(true);
      setNuevaContrasena("");
      setMostrarContrasena(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-6 pb-4">
      <nav
        className="sticky top-0 z-10 -mx-1 flex gap-1.5 overflow-x-auto rounded-xl border border-stone-200 bg-white/90 px-3 py-2 backdrop-blur"
        aria-label="Ir a una sección de esta página"
      >
        {NAV_SECCIONES.filter((s) => s.id !== "seccion-contrasena" || !directorioActivo).map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="flex-none whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium text-stone-600 transition hover:bg-cdmb-50 hover:text-cdmb-700"
          >
            {s.etiqueta}
          </a>
        ))}
      </nav>

      <section id="seccion-nombre" className="scroll-mt-16 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <EncabezadoSeccion icono={UserRound} titulo="Nombre completo" ayuda="Nombre y apellidos que se muestran en toda la aplicación." />
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre y apellidos"
          className="w-full max-w-sm rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
        />
        {directorioActivo && (
          <p className="mt-2 text-xs text-stone-400">
            Cuenta de Directorio Activo: el nombre se asignó de forma provisional al crearse. Verifíquelo o corríjalo.
          </p>
        )}
      </section>

      <section id="seccion-rol" className="scroll-mt-16 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <EncabezadoSeccion icono={ShieldCheck} titulo="Rol" ayuda="Administrador: acceso total. Funcionario: solo lo asignado abajo." />
        <div className="grid max-w-sm grid-cols-2 gap-2">
          {(["FUNCIONARIO", "ADMIN"] as const).map((valor) => (
            <button
              key={valor}
              type="button"
              onClick={() => setRol(valor)}
              title={valor === "ADMIN" ? "Acceso total, sin restricciones" : "Solo ve y gestiona lo que se le asigne abajo"}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                rol === valor ? "border-cdmb-600 bg-cdmb-50 text-cdmb-800" : "border-stone-200 text-stone-600 hover:bg-stone-50"
              }`}
            >
              {valor === "ADMIN" ? "Administrador" : "Funcionario"}
            </button>
          ))}
        </div>
        {rol === "ADMIN" && (
          <p className="mt-2.5 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Acceso total automático — los cargos, trámites y secciones de abajo quedan sin efecto.
          </p>
        )}
      </section>

      <section id="seccion-cargos" className="scroll-mt-16 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <EncabezadoSeccion icono={Briefcase} titulo="Cargo(s) en la CDMB" ayuda="Determina qué pasos de un trámite puede gestionar." />
        <p className="mb-2.5 text-xs text-stone-400">Marque uno, varios, o todos los que correspondan.</p>
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-stone-100 bg-stone-50/60 p-2.5">
          {cargos.map((c) => {
            const activo = cargoIds.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => alternarCargo(c.id)}
                aria-pressed={activo}
                title={activo ? `Quitar el cargo "${c.nombre}"` : `Asignar el cargo "${c.nombre}"`}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  activo
                    ? "border-cdmb-600 bg-cdmb-600 text-white"
                    : "border-stone-200 bg-white text-stone-600 hover:border-cdmb-300 hover:text-cdmb-700"
                }`}
              >
                {c.nombre}
              </button>
            );
          })}
        </div>
      </section>

      {!directorioActivo && (
        <section id="seccion-contrasena" className="scroll-mt-16 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <EncabezadoSeccion icono={KeyRound} titulo="Contraseña" ayuda="Defina una nueva contraseña para entregársela al usuario." />
          <p className="mb-3 text-xs text-stone-400">
            Se aplica al hacer clic en «Guardar cambios», al final de la página. Déjela vacía si no quiere cambiarla.
          </p>
          <div className="flex max-w-md flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <input
                type={mostrarContrasena ? "text" : "password"}
                value={nuevaContrasena}
                onChange={(e) => setNuevaContrasena(e.target.value)}
                placeholder="Nueva contraseña (mín. 8 caracteres)"
                autoComplete="new-password"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 pr-9 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              />
              <button
                type="button"
                onClick={() => setMostrarContrasena((v) => !v)}
                title={mostrarContrasena ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-stone-400 hover:text-stone-600"
              >
                {mostrarContrasena ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setNuevaContrasena(generarContrasena());
                setMostrarContrasena(true);
              }}
              title="Generar una contraseña segura al azar"
              className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium text-stone-600 transition hover:bg-stone-50"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Generar
            </button>
            <button
              type="button"
              onClick={copiarContrasena}
              disabled={!nuevaContrasena}
              title="Copiar la contraseña para enviarla al usuario"
              className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium text-stone-600 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copiado ? <Check className="h-3.5 w-3.5 text-cdmb-600" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
              {copiado ? "Copiada" : "Copiar"}
            </button>
          </div>
        </section>
      )}

      <section id="seccion-lectura" className="scroll-mt-16 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <EncabezadoSeccion icono={Eye} titulo="VITAL y SINCA 1.0" ayuda="Solo consulta: define a qué pestañas puede entrar." />
        <p className="mb-3 text-xs text-stone-400">
          Solo consulta, no hay edición. <strong>Minería de datos</strong> es la sección más sensible — resérvela para directivos.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">VITAL</p>
              <BotonAtajo
                tono="activar"
                title="Dar acceso a todas las pestañas de VITAL"
                onClick={() => marcarSecciones(SECCIONES_VITAL.map((s) => s.valor), true)}
              >
                Todos
              </BotonAtajo>
              <BotonAtajo
                tono="desactivar"
                title="Quitar el acceso a todas las pestañas de VITAL"
                onClick={() => marcarSecciones(SECCIONES_VITAL.map((s) => s.valor), false)}
              >
                Ninguno
              </BotonAtajo>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SECCIONES_VITAL.map((s) => {
                const activo = secciones.has(s.valor);
                return (
                  <button
                    key={s.valor}
                    type="button"
                    onClick={() => alternarSeccion(s.valor)}
                    aria-pressed={activo}
                    title={s.ayuda}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      activo
                        ? "border-cdmb-600 bg-cdmb-600 text-white"
                        : "border-stone-200 bg-white text-stone-600 hover:border-cdmb-300 hover:text-cdmb-700"
                    }`}
                  >
                    {s.etiqueta}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">SINCA 1.0</p>
              <BotonAtajo
                tono="activar"
                title="Dar acceso a todas las pestañas de SINCA 1.0"
                onClick={() => marcarSecciones(SECCIONES_SINCA.map((s) => s.valor), true)}
              >
                Todos
              </BotonAtajo>
              <BotonAtajo
                tono="desactivar"
                title="Quitar el acceso a todas las pestañas de SINCA 1.0"
                onClick={() => marcarSecciones(SECCIONES_SINCA.map((s) => s.valor), false)}
              >
                Ninguno
              </BotonAtajo>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SECCIONES_SINCA.map((s) => {
                const activo = secciones.has(s.valor);
                return (
                  <button
                    key={s.valor}
                    type="button"
                    onClick={() => alternarSeccion(s.valor)}
                    aria-pressed={activo}
                    title={s.ayuda}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      activo
                        ? s.valor === "SINCA_MINERIA"
                          ? "border-amber-600 bg-amber-600 text-white"
                          : "border-cdmb-600 bg-cdmb-600 text-white"
                        : "border-stone-200 bg-white text-stone-600 hover:border-cdmb-300 hover:text-cdmb-700"
                    }`}
                  >
                    {s.etiqueta}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="seccion-tramites" className="scroll-mt-16 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <EncabezadoSeccion
            icono={Layers}
            titulo='Trámites de "Trámites ambientales 2.0"'
            ayuda="Ver: solo consulta. Editar: además puede actuar sobre el trámite."
          />
          <span className="flex-none rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
            {totalConAcceso} con acceso
          </span>
        </div>
        <p className="-mt-1.5 mb-2 text-xs text-stone-400">
          Sin marcar, no ve el trámite. <strong>Ver</strong>: solo consulta. <strong>Editar</strong>: además puede radicar,
          avanzar pasos y subir documentos.
        </p>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-stone-400">Todos los trámites:</span>
          <BotonAtajo tono="activar" title="Dar nivel Editar a todos los trámites del catálogo" onClick={() => aplicarACategoria(todosLosTramites, "EDITAR")}>
            Editar todos
          </BotonAtajo>
          <BotonAtajo tono="ver" title="Dar nivel Ver a todos los trámites del catálogo" onClick={() => aplicarACategoria(todosLosTramites, "VER")}>
            Ver todos
          </BotonAtajo>
          <BotonAtajo tono="desactivar" title="Quitar el acceso a todos los trámites del catálogo" onClick={() => aplicarACategoria(todosLosTramites, null)}>
            Quitar todos
          </BotonAtajo>
        </div>

        <div className="space-y-3 rounded-lg border border-stone-100 p-3">
          {tramitesPorCategoria.map((grupo) => (
            <div key={grupo.etiqueta} className="relative overflow-hidden rounded-lg bg-stone-50/60 pl-3">
              <span className={`absolute inset-y-0 left-0 w-1 ${grupo.claseBarra}`} aria-hidden />
              <div className="p-2">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${grupo.claseBadge}`}>
                    {grupo.etiqueta} ({grupo.items.length})
                  </span>
                  <div className="flex flex-wrap gap-1">
                    <BotonAtajo tono="activar" title={`Editar todos los trámites de ${grupo.etiqueta}`} onClick={() => aplicarACategoria(grupo.items, "EDITAR")}>
                      Editar todos
                    </BotonAtajo>
                    <BotonAtajo tono="ver" title={`Ver todos los trámites de ${grupo.etiqueta}`} onClick={() => aplicarACategoria(grupo.items, "VER")}>
                      Ver todos
                    </BotonAtajo>
                    <BotonAtajo tono="desactivar" title={`Quitar el acceso a ${grupo.etiqueta}`} onClick={() => aplicarACategoria(grupo.items, null)}>
                      Quitar
                    </BotonAtajo>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {grupo.items.map((t) => {
                    const nivel = acceso.get(t.id) ?? null;
                    return (
                      <div key={t.id} className="rounded-md border border-stone-200 bg-white p-2">
                        <p className="mb-1.5 line-clamp-2 text-xs text-stone-700" title={t.nombre}>
                          <span className="mr-1 text-stone-400">{t.codigo}</span>
                          {t.nombre}
                        </p>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => ponerNivel(t.id, null)}
                            title="Sin acceso: no ve este trámite"
                            className={`${BOTON_BASE} ${nivel === null ? "border-stone-400 bg-stone-100 text-stone-700" : "border-stone-200 text-stone-400 hover:bg-stone-50"}`}
                          >
                            Sin acceso
                          </button>
                          <button
                            type="button"
                            onClick={() => ponerNivel(t.id, "VER")}
                            title="Ver: consulta el catálogo y los expedientes, sin poder actuar"
                            className={`${BOTON_BASE} ${nivel === "VER" ? "border-sky-600 bg-sky-600 text-white" : "border-stone-200 text-stone-500 hover:bg-sky-50"}`}
                          >
                            Ver
                          </button>
                          <button
                            type="button"
                            onClick={() => ponerNivel(t.id, "EDITAR")}
                            title="Editar: además puede radicar, avanzar pasos, subir documentos y comentar"
                            className={`${BOTON_BASE} ${nivel === "EDITAR" ? "border-cdmb-600 bg-cdmb-600 text-white" : "border-stone-200 text-stone-500 hover:bg-cdmb-50"}`}
                          >
                            Editar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-t-xl border border-stone-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.08)] backdrop-blur">
        <div className="min-w-0 flex-1 text-sm">
          {error && <span className="text-red-700">{error}</span>}
          {!error && ok && <span className="text-green-700">Cambios guardados.</span>}
        </div>
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          title="Guarda todos los cambios de esta página"
          className="flex-none rounded-md bg-cdmb-600 px-5 py-2 text-sm font-medium text-white transition-transform hover:bg-cdmb-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
