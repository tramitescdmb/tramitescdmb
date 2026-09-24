import { db } from "../src/lib/db";

async function main() {
  const etapasCerradas = await db.etapaExpedienteContractual.findMany({
    where: { completadaEn: { not: null } },
    select: { expedienteId: true, etapa: true, aprobadaPorId: true, completadaEn: true },
  });

  let totalAprobados = 0;
  for (const et of etapasCerradas) {
    const documentos = await db.documentoContrato.findMany({
      where: { expedienteId: et.expedienteId, etapa: et.etapa, estadoValidacion: "PENDIENTE" },
      select: { id: true, solicitudesFirma: { select: { rol: true, estado: true } } },
    });
    const idsParaAprobar = documentos
      .filter((d) => !d.solicitudesFirma.some((s) => s.rol === "FIRMA" && s.estado === "PENDIENTE"))
      .map((d) => d.id);
    if (idsParaAprobar.length === 0) continue;

    await db.documentoContrato.updateMany({
      where: { id: { in: idsParaAprobar } },
      data: { estadoValidacion: "APROBADO", validadoPorId: et.aprobadaPorId, validadoEn: et.completadaEn },
    });
    totalAprobados += idsParaAprobar.length;
    console.log(`Expediente ${et.expedienteId} / etapa ${et.etapa}: ${idsParaAprobar.length} documento(s) aprobado(s).`);
  }

  console.log(`Listo. ${totalAprobados} documento(s) actualizado(s) en total.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
