"use client";

import { useId, type ReactNode } from "react";
import { Building2, IdCard, Landmark, Mail, MapPin, Phone, Smartphone, UserRound, Users, type LucideIcon } from "lucide-react";
import { SelectorDepartamentoCiudad } from "@/components/SelectorDepartamentoCiudad";
import { REGIMENES_TRIBUTARIOS } from "@/lib/regimen-tributario";
import { TIPOS_IDENTIFICACION_PERSONA, type DatosPersona, type OpcionIdentificacion, type TipoPersonaValor } from "@/lib/datos-persona";

export const CLASE_CAMPO_PERSONA =
  "w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500 disabled:bg-stone-50 disabled:text-stone-500";

function Campo({ etiqueta, requerido, children, id, icono: Icono }: { etiqueta: string; requerido?: boolean; children: ReactNode; id: string; icono: LucideIcon }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 flex items-center gap-1.5 text-sm font-medium text-stone-700">
        <Icono className="h-4 w-4 flex-none text-cdmb-600" aria-hidden />
        {etiqueta}
        {requerido && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export function CamposPersona({
  valor,
  onChange,
  tiposIdentificacion = TIPOS_IDENTIFICACION_PERSONA,
  tributaria = false,
  identificacionBloqueada = false,
  sinIdentificacion = false,
  requeridos = { identificacion: true, nombre: true },
  etiquetaCorreo = "Correo electrónico",
  onIdentificacionLista,
  claseCampo = CLASE_CAMPO_PERSONA,
}: {
  valor: DatosPersona;
  onChange: (v: DatosPersona) => void;
  tiposIdentificacion?: OpcionIdentificacion[];
  tributaria?: boolean;
  identificacionBloqueada?: boolean;
  sinIdentificacion?: boolean;
  requeridos?: Partial<Record<"identificacion" | "nombre" | "email" | "direccion" | "ubicacion" | "regimenTributario", boolean>>;
  etiquetaCorreo?: string;
  onIdentificacionLista?: (identificacion: string) => void;
  claseCampo?: string;
}) {
  const id = useId();
  const esJuridica = valor.tipoPersona === "JURIDICA";
  const cambiar = <K extends keyof DatosPersona>(campo: K, v: DatosPersona[K]) => onChange({ ...valor, [campo]: v });

  const cambiarTipoPersona = (tipoPersona: TipoPersonaValor) => {
    const tipoIdentificacion =
      tipoPersona === "JURIDICA" && tiposIdentificacion.some((t) => t.valor === "NIT")
        ? "NIT"
        : valor.tipoIdentificacion === "NIT" && tiposIdentificacion.some((t) => t.valor === "CC")
          ? "CC"
          : valor.tipoIdentificacion;
    onChange({ ...valor, tipoPersona, tipoIdentificacion });
  };

  return (
    <div className="space-y-3">
      <div className={`grid gap-3 ${sinIdentificacion ? "sm:grid-cols-1" : "sm:grid-cols-3"}`}>
        <Campo icono={Users} etiqueta="Tipo de persona" id={`${id}-tipo`}>
          <select
            id={`${id}-tipo`}
            value={valor.tipoPersona}
            onChange={(e) => cambiarTipoPersona(e.target.value as TipoPersonaValor)}
            className={claseCampo}
          >
            <option value="NATURAL">Persona natural</option>
            <option value="JURIDICA">Persona jurídica</option>
          </select>
        </Campo>
        {!sinIdentificacion && (
          <>
            <Campo icono={IdCard} etiqueta="Tipo de documento" id={`${id}-tipoid`}>
              <select
                id={`${id}-tipoid`}
                value={valor.tipoIdentificacion}
                onChange={(e) => cambiar("tipoIdentificacion", e.target.value)}
                disabled={identificacionBloqueada}
                className={claseCampo}
              >
                {tiposIdentificacion.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.etiqueta}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo icono={IdCard} etiqueta="Número de documento" requerido={requeridos.identificacion} id={`${id}-numero`}>
              <input
                id={`${id}-numero`}
                value={valor.identificacion}
                onChange={(e) => cambiar("identificacion", e.target.value)}
                onBlur={() => onIdentificacionLista?.(valor.identificacion.trim())}
                disabled={identificacionBloqueada}
                placeholder={esJuridica ? "Ej. 900123456-1" : "Ej. 91234567"}
                className={claseCampo}
              />
            </Campo>
          </>
        )}
      </div>

      {esJuridica ? (
        <Campo icono={Building2} etiqueta="Razón social" requerido={requeridos.nombre} id={`${id}-razon`}>
          <input id={`${id}-razon`} value={valor.razonSocial} onChange={(e) => cambiar("razonSocial", e.target.value)} className={claseCampo} />
        </Campo>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo icono={UserRound} etiqueta="Nombres" requerido={requeridos.nombre} id={`${id}-nombres`}>
            <input id={`${id}-nombres`} value={valor.nombres} onChange={(e) => cambiar("nombres", e.target.value)} className={claseCampo} />
          </Campo>
          <Campo icono={UserRound} etiqueta="Apellidos" requerido={requeridos.nombre} id={`${id}-apellidos`}>
            <input id={`${id}-apellidos`} value={valor.apellidos} onChange={(e) => cambiar("apellidos", e.target.value)} className={claseCampo} />
          </Campo>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Campo icono={Mail} etiqueta={etiquetaCorreo} requerido={requeridos.email} id={`${id}-correo`}>
          <input id={`${id}-correo`} type="email" value={valor.email} onChange={(e) => cambiar("email", e.target.value)} className={claseCampo} />
        </Campo>
        <Campo icono={Smartphone} etiqueta="Celular" id={`${id}-celular`}>
          <input id={`${id}-celular`} type="tel" value={valor.celular} onChange={(e) => cambiar("celular", e.target.value)} placeholder="Ej. 3001234567" className={claseCampo} />
        </Campo>
        <Campo icono={Phone} etiqueta="Teléfono" id={`${id}-telefono`}>
          <input id={`${id}-telefono`} type="tel" value={valor.telefono} onChange={(e) => cambiar("telefono", e.target.value)} placeholder="Ej. 6076970000" className={claseCampo} />
        </Campo>
      </div>

      <SelectorDepartamentoCiudad
        valor={{ departamento: valor.departamento, ciudad: valor.ciudad }}
        onChange={(u) => onChange({ ...valor, departamento: u.departamento, ciudad: u.ciudad })}
        claseCampo={claseCampo}
        requerido={requeridos.ubicacion}
      />

      <Campo icono={MapPin} etiqueta="Dirección" requerido={requeridos.direccion} id={`${id}-direccion`}>
        <input id={`${id}-direccion`} value={valor.direccion} onChange={(e) => cambiar("direccion", e.target.value)} className={claseCampo} />
      </Campo>

      {tributaria && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo icono={Landmark} etiqueta="Régimen tributario" requerido={requeridos.regimenTributario} id={`${id}-regimen`}>
            <select id={`${id}-regimen`} value={valor.regimenTributario} onChange={(e) => cambiar("regimenTributario", e.target.value)} className={claseCampo}>
              <option value="">Sin especificar</option>
              {REGIMENES_TRIBUTARIOS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Campo>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={valor.granContribuyente}
                onChange={(e) => cambiar("granContribuyente", e.target.checked)}
                className="h-4 w-4 rounded border-stone-200 text-cdmb-600 focus:ring-vivo-500"
              />
              Gran contribuyente
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
