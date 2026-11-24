"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Search, Trash2, UserPlus, X } from "lucide-react";
import { MUNICIPIOS_NV, normalizarTexto } from "@/lib/negocios-verdes";
import { NATURALEZAS } from "@/lib/negocios-verdes-ficha";
import { TIPOS_PERSONA, type TipoPersonaNV } from "@/lib/negocios-verdes-catalogo";
import { llamarNV } from "@/lib/negocios-verdes-cliente";
import { PaginadorNV, claseBotonFlotanteNV } from "@/components/negocios-verdes/admin/ListaNegociosNV";

export type PersonaFila = {
  id: string;
  tipo: TipoPersonaNV;
  nombres: string;
  apellidos: string;
  tipoDocumento: string;
  documento: string;
  telefono: string;
  correo: string;
  cargo: string;
  direccion: string;
  municipio: string;
  naturalezaJuridica: string;
  activo: boolean;
  negocios: { id: string; nombre: string }[];
};

const VACIA: Omit<PersonaFila, "id" | "negocios"> = {
  tipo: "REPRESENTANTE",
  nombres: "",
  apellidos: "",
  tipoDocumento: "CC",
  documento: "",
  telefono: "",
  correo: "",
  cargo: "",
  direccion: "",
  municipio: "",
  naturalezaJuridica: "",
  activo: true,
};
const entrada = "w-full rounded-[8px] border border-nv-borde bg-white px-3 py-2 text-sm focus:border-nv-primario focus:outline-none";
const POR_PAGINA = 20;
/** Rótulos de los filtros, como en la plataforma anterior. */
const CHIPS: [TipoPersonaNV, string, string][] = [
  ["RESPONSABLE_CDMB", "Responsable CDMB", "Nuevo responsable cdmb"],
  ["DELEGADO", "Delegado", "Nuevo delegado"],
  ["REPRESENTANTE", "Representante legal", "Nuevo representante legal"],
];

export function PersonasNV({ personas, puedeCrear, puedeEditar, puedeEliminar, busquedaInicial = "" }: { personas: PersonaFila[]; puedeCrear: boolean; puedeEditar: boolean; puedeEliminar: boolean; busquedaInicial?: string }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoPersonaNV>("RESPONSABLE_CDMB");
  const [q, setQ] = useState(busquedaInicial);
  const [municipio, setMunicipio] = useState("");
  const [pagina, setPagina] = useState(1);
  const [editando, setEditando] = useState<(Omit<PersonaFila, "negocios" | "id"> & { id: string | null }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const visibles = useMemo(() => {
    const t = normalizarTexto(q);
    return personas
      .filter((p) => p.tipo === tipo && (!municipio || p.municipio === municipio) && (!t || normalizarTexto(`${p.documento} ${p.nombres} ${p.apellidos} ${p.cargo} ${p.correo}`).includes(t)))
      .sort((a, b) => `${b.nombres} ${b.apellidos}`.localeCompare(`${a.nombres} ${a.apellidos}`, "es"));
  }, [personas, tipo, q, municipio]);
  const paginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA));
  const actual = Math.min(pagina, paginas);
  const pag = visibles.slice((actual - 1) * POR_PAGINA, actual * POR_PAGINA);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setGuardando(true);
    setError(null);
    try {
      await llamarNV("/api/negocios-verdes/personas", "POST", editando);
      setEditando(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(p: PersonaFila) {
    if (!window.confirm(`¿Eliminar a ${p.nombres} ${p.apellidos}?`)) return;
    try {
      await llamarNV(`/api/negocios-verdes/personas?id=${p.id}`, "DELETE");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const campo = (k: keyof typeof VACIA, etiqueta: string, extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <label className="block text-sm">
      <span className="mb-1 block text-nv-texto2">{etiqueta}</span>
      <input value={String(editando?.[k] ?? "")} onChange={(e) => setEditando((x) => x && { ...x, [k]: e.target.value })} className={entrada} {...extra} />
    </label>
  );
  const chip = CHIPS.find(([k]) => k === tipo)!;

  return (
    <div className="pb-20">
      <h2 className="mb-3 text-[26px] font-normal">Personas</h2>
      <div className="mb-4 flex flex-wrap gap-2">
        {CHIPS.map(([k, texto]) => (
          <button
            key={k}
            type="button"
            aria-pressed={tipo === k}
            onClick={() => {
              setTipo(k);
              setPagina(1);
            }}
            className={`inline-flex items-center gap-2 rounded-[8px] px-4 py-1.5 text-sm ${tipo === k ? "bg-nv-menu text-nv-texto" : "bg-nv-claro text-nv-texto hover:brightness-95"}`}
          >
            {tipo === k && <Check className="h-4 w-4" aria-hidden />}
            {texto}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-nv-texto2" aria-hidden />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPagina(1);
            }}
            placeholder="NIT, cédula, nombre, cargo o correo…"
            aria-label="Buscar personas"
            className="w-full rounded-[8px] border border-nv-texto2/40 bg-white py-2.5 pl-10 pr-3 text-[15px] focus:border-nv-primario focus:outline-none"
          />
        </label>
        <label className="relative w-full sm:w-52">
          <span className="absolute -top-2 left-3 bg-nv-fondo px-1 text-xs text-nv-texto2">Municipio</span>
          <select
            value={municipio}
            onChange={(e) => {
              setMunicipio(e.target.value);
              setPagina(1);
            }}
            className="w-full rounded-[8px] border border-nv-texto2/40 bg-transparent px-3 py-2.5 text-[15px] focus:border-nv-primario focus:outline-none"
          >
            <option value="">Todos</option>
            {MUNICIPIOS_NV.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="mt-3 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <PaginadorNV total={visibles.length} pagina={actual} porPagina={POR_PAGINA} alCambiar={setPagina} />

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs font-medium uppercase tracking-[0.06em] text-nv-texto">
            <tr className="border-b border-nv-borde">
              <th className="px-1 py-3 font-medium">Identificación</th>
              <th className="px-3 py-3 font-medium">Nombre</th>
              <th className="px-3 py-3 font-medium">Municipio</th>
              <th className="px-3 py-3 font-medium">Negocios</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {pag.map((p) => (
              <tr key={p.id} className={`border-b border-nv-borde hover:bg-black/[0.04] ${p.activo ? "" : "text-nv-texto2"}`}>
                <td className="px-1 py-4 align-top">{[p.tipoDocumento, p.documento].filter(Boolean).join(" ") || "—"}</td>
                <td className="px-3 py-4 font-medium uppercase tracking-[0.04em]">
                  {p.nombres} {p.apellidos}
                  {!p.activo && <span className="ml-1 text-xs normal-case">(inactiva)</span>}
                </td>
                <td className="px-3 py-4">{p.municipio || "—"}</td>
                <td className="px-3 py-4" title={p.negocios.map((n) => n.nombre).join(", ")}>
                  {p.negocios.length}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-right">
                  {puedeEditar && (
                    <button type="button" aria-label={`Editar a ${p.nombres}`} onClick={() => setEditando({ ...p })} className="rounded-full p-1.5 text-nv-texto hover:bg-black/5">
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {puedeEliminar && (
                    <button type="button" aria-label={`Eliminar a ${p.nombres}`} disabled={p.negocios.length > 0} title={p.negocios.length ? "Tiene negocios vinculados" : "Eliminar"} onClick={() => eliminar(p)} className="rounded-full p-1.5 text-nv-texto hover:bg-black/5 disabled:text-nv-texto2/40">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {pag.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-nv-texto2">
                  Sin resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {puedeCrear && (
        <button type="button" onClick={() => setEditando({ ...VACIA, tipo, id: null })} className={claseBotonFlotanteNV}>
          <UserPlus className="h-5 w-5" aria-hidden /> {chip[2]}
        </button>
      )}

      {editando && (
        <div className="fixed inset-0 z-[1600] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-persona">
          <form onSubmit={guardar} className="max-h-[90dvh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-[16px] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 id="titulo-persona" className="text-xl font-medium">
                {editando.id ? "Editar persona" : chip[2].replace("cdmb", "CDMB")}
              </h2>
              <button type="button" aria-label="Cerrar" onClick={() => setEditando(null)} className="rounded-full p-1.5 hover:bg-black/5">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-nv-texto2">Datos internos de la CDMB: nunca salen en el sitio público. Los vínculos con cada negocio se asignan desde la ficha del negocio.</p>
            {error && <p className="rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block text-sm">
                <span className="mb-1 block text-nv-texto2">Tipo *</span>
                <select value={editando.tipo} onChange={(e) => setEditando({ ...editando, tipo: e.target.value as TipoPersonaNV })} className={entrada}>
                  {Object.entries(TIPOS_PERSONA).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              {campo("nombres", "Nombres *", { required: true })}
              {campo("apellidos", "Apellidos")}
              {campo("tipoDocumento", "Tipo de documento")}
              {campo("documento", "Documento")}
              {campo("telefono", "Teléfono", { inputMode: "tel" })}
              {campo("correo", "Correo", { type: "email" })}
              {campo("cargo", "Cargo")}
              {campo("direccion", "Dirección")}
              <label className="block text-sm">
                <span className="mb-1 block text-nv-texto2">Municipio</span>
                <select value={editando.municipio} onChange={(e) => setEditando({ ...editando, municipio: e.target.value })} className={entrada}>
                  <option value="">—</option>
                  {MUNICIPIOS_NV.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              {editando.tipo === "REPRESENTANTE" && (
                <label className="block text-sm">
                  <span className="mb-1 block text-nv-texto2">Naturaleza jurídica</span>
                  <select value={editando.naturalezaJuridica} onChange={(e) => setEditando({ ...editando, naturalezaJuridica: e.target.value })} className={entrada}>
                    <option value="">—</option>
                    {NATURALEZAS.map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex items-center gap-2 self-end text-sm">
                <input type="checkbox" checked={editando.activo} onChange={(e) => setEditando({ ...editando, activo: e.target.checked })} className="accent-nv-primario" /> Activa
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditando(null)} className="rounded-[8px] px-4 py-2 text-sm font-semibold text-nv-primario hover:bg-nv-claro">
                Cancelar
              </button>
              <button disabled={guardando} className="rounded-[8px] bg-nv-primario px-5 py-2 text-sm font-semibold text-white hover:bg-nv-oscuro disabled:opacity-60">
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
