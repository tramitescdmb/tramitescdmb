import Link from "next/link";
import { revisionDatosNV } from "@/lib/negocios-verdes-admin";

export const dynamic = "force-dynamic";

export default async function RevisionDatosNV({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const { ver } = await searchParams;
  const todas = await revisionDatosNV();
  const graves = todas.filter((f) => f.problemas.some((p) => p.grave));
  const filas = ver === "avisos" ? todas.filter((f) => !f.problemas.some((p) => p.grave)) : ver === "todo" ? todas : graves;
  const pestana = (v: string | undefined, texto: string, n: number) => (
    <Link
      prefetch={false}
      href={v ? `/negocios-verdes/admin/revision?ver=${v}` : "/negocios-verdes/admin/revision"}
      className={`rounded-full px-3 py-1 text-sm ${ver === v ? "bg-emerald-700 text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200"}`}
    >
      {texto} ({n})
    </Link>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-600">
        El verificador revisa que el correo esté bien escrito y que las coordenadas caigan dentro de los 13 municipios de la jurisdicción. Lo marcado en rojo impide guardar
        el negocio (o importarlo por CSV) hasta corregirlo. Los avisos en ámbar no impiden guardar: el límite entre municipios es aproximado.
      </p>
      <div className="flex flex-wrap gap-2">
        {pestana(undefined, "Por corregir", graves.length)}
        {pestana("avisos", "Solo avisos", todas.length - graves.length)}
        {pestana("todo", "Todo", todas.length)}
      </div>
      {filas.length === 0 ? (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">No hay nada pendiente en esta lista.</p>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
          {filas.map((f) => (
            <li key={`${f.tipo}-${f.id}`} className="space-y-1 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  prefetch={false}
                  href={f.tipo === "negocio" ? `/negocios-verdes/admin/negocios/${f.id}` : `/negocios-verdes/admin/personas?q=${encodeURIComponent(f.nombre)}`}
                  className="font-medium text-stone-900 hover:text-emerald-800 hover:underline"
                >
                  {f.nombre}
                </Link>
                <span className="rounded bg-stone-100 px-1.5 text-xs text-stone-600">{f.tipo === "negocio" ? "Negocio" : "Persona"}</span>
                {f.municipio && <span className="text-xs text-stone-500">{f.municipio}</span>}
                {!f.activo && <span className="text-xs text-stone-400">{f.tipo === "negocio" ? "sin publicar" : "inactiva"}</span>}
              </div>
              <ul className="space-y-0.5 text-sm">
                {f.problemas.map((p, i) => (
                  <li key={i} className={p.grave ? "text-red-700" : "text-amber-700"}>
                    {p.texto}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
