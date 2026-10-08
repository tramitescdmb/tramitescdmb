"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AtSign, BadgeCheck, Briefcase, KeyRound, Lock, Network, PenLine, ShieldCheck, UserRound } from "lucide-react";
import { CamposPersona, CLASE_CAMPO_PERSONA } from "@/components/CamposPersona";
import { EncabezadoPaso } from "@/components/sgdea/EncabezadoPaso";
import { personaVacia, TIPOS_IDENTIFICACION_USUARIO, type DatosPersona } from "@/lib/datos-persona";
import { CLAVES_DENOMINACION_EMPLEO, DENOMINACIONES_EMPLEO, SEXOS } from "@/lib/denominacion-empleo";

type Acceso = "DIRECTORIO_ACTIVO" | "LOCAL";

export function NuevoUsuarioForm({
  cargos,
  longitudMinima,
  longitudMaxima,
}: {
  cargos: { id: string; nombre: string }[];
  longitudMinima: number;
  longitudMaxima: number;
}) {
  const router = useRouter();
  const [acceso, setAcceso] = useState<Acceso>("DIRECTORIO_ACTIVO");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [persona, setPersona] = useState<DatosPersona>(personaVacia());
  const [rol, setRol] = useState<"FUNCIONARIO" | "ADMIN">("FUNCIONARIO");
  const [sexo, setSexo] = useState("");
  const [denominacionEmpleo, setDenominacionEmpleo] = useState("");
  const [denominacionComplemento, setDenominacionComplemento] = useState("");
  const [accesoFirma, setAccesoFirma] = useState(true);
  const [cargoIds, setCargoIds] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esRed = acceso === "DIRECTORIO_ACTIVO";

  function alternarCargo(id: string) {
    setCargoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function crear() {
    setError(null);
    if (!email.trim()) return setError(esRed ? "Indique el usuario de red." : "Indique el correo con el que inicia sesión.");
    if (!esRed && password.length < longitudMinima) return setError(`La contraseña temporal debe tener al menos ${longitudMinima} caracteres.`);
    if (persona.tipoPersona === "JURIDICA" ? !persona.razonSocial.trim() : !persona.nombres.trim() || !persona.apellidos.trim()) {
      return setError(persona.tipoPersona === "JURIDICA" ? "Indique la razón social." : "Indique los nombres y los apellidos.");
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acceso,
          email: email.trim(),
          password: esRed ? undefined : password,
          persona,
          rol,
          sexo: sexo || null,
          denominacionEmpleo: denominacionEmpleo || null,
          denominacionComplemento: denominacionComplemento.trim() || null,
          accesoFirma,
          cargoIds: Array.from(cargoIds),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo crear el usuario.");
      router.push(`/usuarios/${body.id}?ok=${encodeURIComponent("Usuario creado. Configure sus accesos abajo.")}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
      setGuardando(false);
    }
  }

  return (
    <div className="mt-5 space-y-5">
      <div className="space-y-3">
        <EncabezadoPaso numero={1} icono={<KeyRound className="h-4 w-4" aria-hidden />} titulo="Acceso a la plataforma" />
        <div className="grid max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
          {(
            [
              { valor: "DIRECTORIO_ACTIVO", titulo: "Usuario de red", detalle: "Ingresa con su cuenta del dominio CDMB.", icono: Network },
              { valor: "LOCAL", titulo: "Cuenta local", detalle: "Correo y contraseña de esta plataforma.", icono: KeyRound },
            ] as const
          ).map((o) => (
            <button
              key={o.valor}
              type="button"
              onClick={() => setAcceso(o.valor)}
              aria-pressed={acceso === o.valor}
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-left transition ${
                acceso === o.valor ? "border-cdmb-600 bg-cdmb-50" : "border-stone-200 bg-white hover:bg-stone-50"
              }`}
            >
              <o.icono className="mt-0.5 h-4 w-4 flex-none text-cdmb-700" aria-hidden />
              <span>
                <span className="block text-sm font-medium text-stone-800">{o.titulo}</span>
                <span className="block text-xs text-stone-500">{o.detalle}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-sm font-medium text-stone-700">
              <AtSign className="h-4 w-4 flex-none text-cdmb-600" aria-hidden />
              {esRed ? "Usuario de red" : "Correo para iniciar sesión"} <span className="text-red-500">*</span>
            </span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type={esRed ? "text" : "email"}
              autoComplete="off"
              placeholder={esRed ? "Ej. jperez01" : "nombre@cdmb.gov.co"}
              className={CLASE_CAMPO_PERSONA}
            />
          </label>
          {!esRed && (
            <label className="block">
              <span className="mb-1 flex items-center gap-1.5 text-sm font-medium text-stone-700">
              <Lock className="h-4 w-4 flex-none text-cdmb-600" aria-hidden />
                Contraseña temporal <span className="text-red-500">*</span>
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={longitudMinima}
                maxLength={longitudMaxima}
                className={CLASE_CAMPO_PERSONA}
              />
            </label>
          )}
        </div>
      </div>

      <div className="space-y-3 border-t border-stone-100 pt-4">
        <EncabezadoPaso numero={2} icono={<UserRound className="h-4 w-4" aria-hidden />} titulo="Datos personales" />
        <CamposPersona
          valor={persona}
          onChange={setPersona}
          tiposIdentificacion={TIPOS_IDENTIFICACION_USUARIO}
          tributaria
          requeridos={{ nombre: true }}
          etiquetaCorreo="Correo de notificación"
        />
      </div>

      <div className="space-y-3 border-t border-stone-100 pt-4">
        <EncabezadoPaso numero={3} icono={<ShieldCheck className="h-4 w-4" aria-hidden />} titulo="Rol y firma" />
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-sm font-medium text-stone-700">
              <ShieldCheck className="h-4 w-4 flex-none text-cdmb-600" aria-hidden />Rol</span>
            <select value={rol} onChange={(e) => setRol(e.target.value as "FUNCIONARIO" | "ADMIN")} className={CLASE_CAMPO_PERSONA}>
              <option value="FUNCIONARIO">Funcionario</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-sm font-medium text-stone-700">
              <UserRound className="h-4 w-4 flex-none text-cdmb-600" aria-hidden />Sexo</span>
            <select value={sexo} onChange={(e) => setSexo(e.target.value)} className={CLASE_CAMPO_PERSONA}>
              <option value="">Sin especificar</option>
              {SEXOS.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-sm font-medium text-stone-700">
              <BadgeCheck className="h-4 w-4 flex-none text-cdmb-600" aria-hidden />Denominación del empleo</span>
            <select value={denominacionEmpleo} onChange={(e) => setDenominacionEmpleo(e.target.value)} className={CLASE_CAMPO_PERSONA}>
              <option value="">Sin denominación</option>
              {CLAVES_DENOMINACION_EMPLEO.map((c) => (
                <option key={c} value={c}>
                  {sexo === "F" ? DENOMINACIONES_EMPLEO[c].f : DENOMINACIONES_EMPLEO[c].m}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-sm font-medium text-stone-700">
              <PenLine className="h-4 w-4 flex-none text-cdmb-600" aria-hidden />Complemento</span>
            <input
              value={denominacionComplemento}
              onChange={(e) => setDenominacionComplemento(e.target.value)}
              maxLength={120}
              placeholder="en Tecnologías de Información"
              className={CLASE_CAMPO_PERSONA}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" checked={accesoFirma} onChange={(e) => setAccesoFirma(e.target.checked)} className="rounded border-stone-200" />
          Puede firmar electrónicamente oficios y memorandos
        </label>
      </div>

      {cargos.length > 0 && (
        <div className="space-y-3 border-t border-stone-100 pt-4">
          <EncabezadoPaso numero={4} icono={<Briefcase className="h-4 w-4" aria-hidden />} titulo="Cargo(s) para Trámites ambientales 2.0" descripcion="Opcional." />
          <div className="flex flex-wrap gap-1.5 rounded-lg border border-stone-200 bg-stone-50/60 p-2.5">
            {cargos.map((c) => {
              const activo = cargoIds.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => alternarCargo(c.id)}
                  aria-pressed={activo}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    activo ? "border-menu-500 bg-menu-500 text-stone-900" : "border-stone-200 bg-white text-stone-600 hover:border-cdmb-300 hover:text-cdmb-700"
                  }`}
                >
                  {c.nombre}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4">
        <span className="text-sm text-red-700">{error}</span>
        <button
          type="button"
          onClick={crear}
          disabled={guardando}
          className="rounded-md bg-acento-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-acento-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {guardando ? "Creando…" : "Crear usuario"}
        </button>
      </div>
    </div>
  );
}
