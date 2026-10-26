export function ResumenBuzonFirmas({ solicitudes }: { solicitudes: { puedeActuar: boolean; esperaA: { nombre: string }[] }[] }) {
  if (solicitudes.length === 0) return null;
  const listas = solicitudes.filter((s) => s.puedeActuar).length;
  const enEspera = solicitudes.filter((s) => !s.puedeActuar);
  const quienes = [...new Set(enEspera.flatMap((s) => s.esperaA.map((e) => e.nombre)))];
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <p>
        <strong>
          Tiene {solicitudes.length} documento{solicitudes.length === 1 ? "" : "s"} por firmar o revisar.
        </strong>{" "}
        {listas > 0 ? `Puede firmar ahora ${listas}.` : "Todavía no es su turno en ninguno."}
      </p>
      {enEspera.length > 0 && (
        <p className="mt-0.5 text-xs">
          {enEspera.length} en espera porque antes debe{quienes.length === 1 ? "" : "n"} firmar {quienes.join(", ") || "un cargo superior"}. Le llegará el aviso
          cuando sea su turno; si es urgente, use «Recordar» en el documento.
        </p>
      )}
    </div>
  );
}
