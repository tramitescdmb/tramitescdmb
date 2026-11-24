"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { MUNICIPIOS_NV, normalizarTexto } from "@/lib/negocios-verdes";
import { NATURALEZAS } from "@/lib/negocios-verdes-ficha";
import { TIPOS_PERSONA, type TipoPersonaNV } from "@/lib/negocios-verdes-catalogo";
import { llamarNV } from "@/lib/negocios-verdes-cliente";

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
const entrada = "w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm";

export function PersonasNV({ personas, puedeCrear, puedeEditar, puedeEliminar }: { personas: PersonaFila[]; puedeCrear: boolean; puedeEditar: boolean; puedeEliminar: boolean }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoPersonaNV | "">("");
  const [q, setQ] = useState("");
  const [editando, setEditando] = useState<(Omit<PersonaFila, "negocios" | "id"> & { id: string | null }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const visibles = useMemo(() => {
    const t = normalizarTexto(q);
    return personas.filter((p) => (!tipo || p.tipo === tipo) && (!t || normalizarTexto(`${p.nombres} ${p.apellidos} ${p.documento} ${p.correo}`).includes(t)));
  }, [personas, tipo, q]);

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
      <span className="mb-1 block text-stone-700">{etiqueta}</span>
      <input value={String(editando?.[k] ?? "")} onChange={(e) => setEditando((x) => x && { ...x, [k]: e.target.value })} className={entrada} {...extra} />
    </label>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-600">Datos internos de la CDMB: nunca salen en el sitio público. Los vínculos con cada negocio se asignan desde la ficha del negocio.</p>
      <div className="flex flex-wrap items-end gap-2">
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoPersonaNV | "")} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm">
          <option value="">Todos los tipos</option>
          {Object.entries(TIPOS_PERSONA).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, documento o correo" className="min-w-[16rem] flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm" />
        {puedeCrear && (
          <button type="button" onClick={() => setEditando({ ...VACIA, id: null })} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800">
            <Plus className="h-4 w-4" aria-hidden /> Nueva persona
          </button>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {editando && (
        <form onSubmit={guardar} className="space-y-3 rounded-xl border border-emerald-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-stone-900">{editando.id ? "Editar persona" : "Nueva persona"}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-sm">
              <span className="mb-1 block text-stone-700">Tipo *</span>
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
              <span className="mb-1 block text-stone-700">Municipio</span>
              <select value={editando.municipio} onChange={(e) => setEditando({ ...editando, municipio: e.target.value })} className={entrada}>
                <option value="">—</option>
                {MUNICIPIOS_NV.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            {editando.tipo === "REPRESENTANTE" && (
              <label className="block text-sm">
                <span className="mb-1 block text-stone-700">Naturaleza jurídica</span>
                <select value={editando.naturalezaJuridica} onChange={(e) => setEditando({ ...editando, naturalezaJuridica: e.target.value })} className={entrada}>
                  <option value="">—</option>
                  {NATURALEZAS.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex items-center gap-2 self-end text-sm">
              <input type="checkbox" checked={editando.activo} onChange={(e) => setEditando({ ...editando, activo: e.target.checked })} /> Activa
            </label>
          </div>
          <div className="flex gap-2">
            <button disabled={guardando} className="rounded-lg bg-emerald-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
              Guardar
            </button>
            <button type="button" onClick={() => setEditando(null)} className="rounded-lg border border-stone-300 px-4 py-1.5 text-sm">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-3 py-2">Persona</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Documento</th>
              <th className="px-3 py-2">Contacto</th>
              <th className="px-3 py-2">Negocios vigentes</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {visibles.map((p) => (
              <tr key={p.id} className={p.activo ? "" : "text-stone-400"}>
                <td className="px-3 py-2 font-medium">
                  {p.nombres} {p.apellidos}
                  {!p.activo && <span className="ml-1 text-xs">(inactiva)</span>}
                </td>
                <td className="px-3 py-2">{TIPOS_PERSONA[p.tipo]}</td>
                <td className="px-3 py-2">{[p.tipoDocumento, p.documento].filter(Boolean).join(" ")}</td>
                <td className="px-3 py-2">{[p.telefono, p.correo].filter(Boolean).join(" · ")}</td>
                <td className="px-3 py-2">
                  {p.negocios.map((n, i) => (
                    <span key={n.id}>
                      {i > 0 && ", "}
                      <Link prefetch={false} href={`/negocios-verdes/admin/negocios/${n.id}`} className="text-emerald-700 hover:underline">
                        {n.nombre}
                      </Link>
                    </span>
                  ))}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {puedeEditar && (
                    <button type="button" aria-label="Editar" onClick={() => setEditando({ ...p })} className="rounded p-1 text-stone-600 hover:bg-stone-100">
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {puedeEliminar && (
                    <button type="button" aria-label="Eliminar" onClick={() => eliminar(p)} className="rounded p-1 text-red-700 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-stone-500">
                  Sin resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-stone-500">{visibles.length} de {personas.length} personas.</p>
    </div>
  );
}
