"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Link2, Loader2, LogOut, Mail, Save } from "lucide-react";
import { Field } from "@/components/Field";
import { CamposPersona } from "@/components/CamposPersona";
import { TIPOS_USUARIO_CIUDADANO } from "@/lib/tipos-usuario-ciudadano";
import { personaVacia, separarNombreCompleto, type DatosPersona } from "@/lib/datos-persona";

const inputCls = "w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500";
const botonCls =
  "inline-flex items-center gap-2 rounded-md bg-acento-500 px-4 py-2 text-sm font-medium text-white hover:bg-acento-600 disabled:opacity-60";

async function enviar(url: string, datos: unknown): Promise<Record<string, unknown>> {
  const resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos ?? {}) });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error((data as { error?: string }).error || "No se pudo completar la acción.");
  return data;
}

/** Datos del perfil tal como los guarda la cuenta (los manda la página del servidor). */
export type PerfilInicial = {
  correo: string;
  tipo: "NATURAL" | "JURIDICA";
  tipoIdentificacion: string | null;
  identificacion: string | null;
  nombres: string | null;
  apellidos: string | null;
  razonSocial: string | null;
  nombre: string | null;
  correoAlterno: string | null;
  celular: string | null;
  telefono: string | null;
  direccion: string | null;
  departamento: string | null;
  ciudad: string | null;
  regimenTributario: string | null;
  granContribuyente: boolean;
  representanteLegal: string | null;
  representanteIdentificacion: string | null;
  tipoUsuario: string | null;
  autorizaNotificacionElectronica: boolean;
  aceptaTratamientoEn: Date | string | null;
};

function aPersona(p: PerfilInicial): DatosPersona {
  const juridica = p.tipo === "JURIDICA";
  // Cuentas creadas antes del perfil completo solo tienen «nombre»: se reparte en nombres y apellidos.
  const partes = !juridica && !p.nombres && p.nombre ? separarNombreCompleto(p.nombre) : null;
  return personaVacia({
    tipoPersona: p.tipo,
    tipoIdentificacion: p.tipoIdentificacion ?? (juridica ? "NIT" : "CC"),
    identificacion: p.identificacion ?? "",
    nombres: p.nombres ?? partes?.nombres ?? "",
    apellidos: p.apellidos ?? partes?.apellidos ?? "",
    razonSocial: p.razonSocial ?? (juridica ? p.nombre ?? "" : ""),
    email: p.correoAlterno ?? "",
    celular: p.celular ?? "",
    telefono: p.telefono ?? "",
    direccion: p.direccion ?? "",
    ...(p.departamento ? { departamento: p.departamento } : {}),
    ...(p.ciudad ? { ciudad: p.ciudad } : {}),
    regimenTributario: p.regimenTributario ?? "",
    granContribuyente: p.granContribuyente,
    representanteLegal: p.representanteLegal ?? "",
    representanteIdentificacion: p.representanteIdentificacion ?? "",
  });
}

/**
 * Perfil del ciudadano: el mismo estándar de datos de persona que el resto del sistema (documento,
 * nombres, contacto, dirección de notificación, régimen tributario y gran contribuyente) más el
 * tipo de usuario. Sirve para el primer ingreso y para «Mi perfil». El documento solo se escribe la
 * primera vez.
 */
export function PerfilCiudadanoForm({ inicial, siguiente }: { inicial: PerfilInicial; siguiente?: string | null }) {
  const router = useRouter();
  const primeraVez = !inicial.identificacion;
  const sinAutorizacion = !inicial.aceptaTratamientoEn;
  const [persona, setPersona] = useState<DatosPersona>(() => aPersona(inicial));
  const [tipoUsuario, setTipoUsuario] = useState(inicial.tipoUsuario ?? "");
  const [notificacion, setNotificacion] = useState(inicial.autorizaNotificacionElectronica);
  const [acepta, setAcepta] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const esJuridica = persona.tipoPersona === "JURIDICA";

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    setOcupado(true);
    try {
      await enviar("/api/solicitud-ambiental/cuenta/perfil", {
        ...persona,
        tipoUsuario,
        autorizaNotificacionElectronica: notificacion,
        aceptaTratamiento: acepta,
      });
      if (siguiente) {
        router.replace(siguiente);
        router.refresh();
        return;
      }
      setAviso("Sus datos quedaron guardados.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
      <div>
        <h2 className="text-base font-semibold text-stone-900">{primeraVez || sinAutorizacion ? "Complete su registro" : "Datos de su perfil"}</h2>
        <p className="mt-1 text-sm text-stone-600">
          {primeraVez ? (
            <>
              Ingresó con <strong>{inicial.correo}</strong>. Indique a nombre de quién radica: verá aquí las solicitudes de ese documento.
            </>
          ) : (
            <>Mantenga al día sus datos de contacto y la dirección donde la CDMB le notifica.</>
          )}
        </p>
      </div>
      {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}
      {aviso && <div className="rounded-xl bg-cdmb-50 px-3 py-2 text-sm text-cdmb-900" role="status">{aviso}</div>}

      <CamposPersona
        valor={persona}
        onChange={setPersona}
        tributaria
        conRepresentante={esJuridica}
        identificacionBloqueada={!primeraVez}
        tipoPersonaBloqueado={!primeraVez}
        etiquetaCorreo="Correo alterno (opcional)"
        requeridos={{ identificacion: true, nombre: true, direccion: true, ubicacion: true, regimenTributario: true, celular: true }}
      />
      {primeraVez ? (
        <p className="text-xs text-stone-500">El documento no se puede cambiar después: verifíquelo antes de guardar.</p>
      ) : (
        <p className="text-xs text-stone-500">
          El tipo y el número de documento no se cambian desde aquí. Si hay un error, solicite la corrección a la CDMB.
        </p>
      )}

      <Field label="¿Qué tipo de usuario es?" required>
        <select value={tipoUsuario} onChange={(e) => setTipoUsuario(e.target.value)} className={inputCls}>
          <option value="">Seleccione…</option>
          {TIPOS_USUARIO_CIUDADANO.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.etiqueta}
            </option>
          ))}
        </select>
      </Field>

      <label className="flex items-start gap-2 text-sm text-stone-700">
        <input type="checkbox" checked={notificacion} onChange={(e) => setNotificacion(e.target.checked)} className="mt-1" />
        <span>
          Autorizo que la CDMB me notifique por correo electrónico los actos administrativos de mis trámites (art. 56 de la Ley 1437 de
          2011), al correo de mi cuenta.
        </span>
      </label>
      {sinAutorizacion && (
        <label className="flex items-start gap-2 text-sm text-stone-700">
          <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-1" />
          <span>
            Autorizo a la CDMB a tratar mis datos personales para gestionar mis solicitudes y comunicarme sus novedades, conforme a la Ley
            1581 de 2012.
          </span>
        </label>
      )}
      <button type="submit" disabled={ocupado} className={botonCls}>
        {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
        {primeraVez || siguiente ? "Guardar y continuar" : "Guardar cambios"}
      </button>
    </form>
  );
}

/** Cambio del correo de la cuenta: código al correo nuevo; el anterior recibe un aviso. */
export function CambiarCorreoForm({ correoActual }: { correoActual: string }) {
  const router = useRouter();
  const [paso, setPaso] = useState<"correo" | "codigo">("correo");
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function pedir(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!correo.trim()) return setError("Escriba el correo nuevo.");
    setOcupado(true);
    try {
      const data = await enviar("/api/solicitud-ambiental/cuenta/correo/codigo", { correo: correo.trim() });
      setAviso(String(data.mensaje ?? ""));
      setPaso("codigo");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el código.");
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOcupado(true);
    try {
      await enviar("/api/solicitud-ambiental/cuenta/correo/verificar", { codigo });
      setPaso("correo");
      setCorreo("");
      setCodigo("");
      setAviso("Listo: el correo de su cuenta cambió. Desde ahora los códigos de ingreso llegarán al correo nuevo.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "El código no es válido.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
      <div>
        <h2 className="text-base font-semibold text-stone-900">Correo de la cuenta</h2>
        <p className="mt-1 text-sm text-stone-600">
          Actual: <strong>{correoActual}</strong>. Con él ingresa y a él le llegan las novedades de sus solicitudes.
        </p>
      </div>
      {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}
      {aviso && <p className="rounded-xl bg-cdmb-50 px-3 py-2 text-sm text-cdmb-900">{aviso}</p>}
      {paso === "correo" ? (
        <form onSubmit={pedir} className="flex flex-wrap items-end gap-2">
          <div className="min-w-[14rem] flex-1">
            <Field label="Correo nuevo" help="Le enviaremos un código a ese correo para confirmar que es suyo.">
              <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} className={inputCls} autoComplete="email" maxLength={200} />
            </Field>
          </div>
          <button type="submit" disabled={ocupado} className={botonCls}>
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Mail className="h-4 w-4" aria-hidden />}
            Enviar código
          </button>
        </form>
      ) : (
        <form onSubmit={confirmar} className="space-y-3">
          <Field label="Código de 6 dígitos" required help={`Enviado a ${correo.trim()}. Vence en 10 minutos.`}>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className={`${inputCls} max-w-[12rem] font-mono text-lg tracking-[0.4em]`}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
            />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={ocupado || codigo.length !== 6} className={botonCls}>
              {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <KeyRound className="h-4 w-4" aria-hidden />}
              Confirmar correo nuevo
            </button>
            <button
              type="button"
              onClick={() => {
                setPaso("correo");
                setCodigo("");
                setAviso(null);
              }}
              className="text-sm text-stone-500 hover:underline"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Agrega a la cuenta una solicitud radicada antes, con el número que recibió. */
export function VincularSolicitudForm() {
  const router = useRouter();
  const [numero, setNumero] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function vincular(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!numero.trim()) return setError("Escriba el número de solicitud.");
    setOcupado(true);
    try {
      await enviar("/api/solicitud-ambiental/cuenta/vincular", { numeroSolicitud: numero });
      setNumero("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={vincular} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-soft">
      <h2 className="text-sm font-semibold text-stone-800">¿Radicó antes sin cuenta?</h2>
      <p className="mt-1 text-xs text-stone-500">Escriba el número de solicitud que recibió (por ejemplo SL-7KQ4-M9XD) para verla aquí.</p>
      {error && <div className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={numero}
          onChange={(e) => setNumero(e.target.value.toUpperCase())}
          className={`${inputCls} max-w-[14rem] font-mono`}
          placeholder="SL-XXXX-XXXX"
          autoComplete="off"
          aria-label="Número de solicitud"
        />
        <button type="submit" disabled={ocupado} className={botonCls}>
          {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
          Agregar
        </button>
      </div>
    </form>
  );
}

export function BotonSalirCiudadano({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  return (
    <button
      type="button"
      disabled={ocupado}
      onClick={async () => {
        setOcupado(true);
        await fetch("/api/solicitud-ambiental/cuenta/salir", { method: "POST" }).catch(() => {});
        router.replace("/solicitud-ambiental");
        router.refresh();
      }}
      className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition bg-white/15 text-white ring-1 ring-white/40 hover:bg-white/25 ${className}`}
    >
      <LogOut className="h-4 w-4" aria-hidden /> Salir
    </button>
  );
}

export function EnlaceIngresar({ siguiente }: { siguiente?: string }) {
  return (
    <Link
      href={siguiente ? `/solicitud-ambiental/ingresar?siguiente=${encodeURIComponent(siguiente)}` : "/solicitud-ambiental/ingresar"}
      className="font-semibold text-cdmb-700 underline hover:no-underline"
    >
      Ingrese con su correo
    </Link>
  );
}
