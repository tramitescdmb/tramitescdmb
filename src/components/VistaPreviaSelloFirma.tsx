export function VistaPreviaSelloFirma({
  nombre,
  identificacion,
  cargo,
  actoAdministrativo,
  dependencia,
}: {
  nombre: string;
  identificacion: string | null;
  cargo: string | null;
  actoAdministrativo: string | null;
  dependencia: string | null;
}) {
  return (
    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2.5">
      <p className="mb-1.5 text-[11px] text-stone-500">Así aparecerá en el sello de la firma:</p>
      <div className="max-w-md border-t border-[#038F67] bg-white px-3 py-2 font-[Helvetica,Arial,sans-serif] text-[11px] leading-snug text-stone-600">
        <p className="mb-1 text-[10px] font-bold tracking-wide text-[#038F67]">DOCUMENTO FIRMADO ELECTRÓNICAMENTE</p>
        <p className="font-bold">{nombre || "Nombre del funcionario"}</p>
        {identificacion && <p>{identificacion}</p>}
        {cargo && <p>{cargo}</p>}
        {actoAdministrativo && <p>{actoAdministrativo}</p>}
        {dependencia && <p>{dependencia}</p>}
        <p className="text-[10px] text-stone-400">Fecha y hora de la firma · SHA-256</p>
      </div>
    </div>
  );
}
