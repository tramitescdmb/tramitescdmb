#!/bin/bash
# Crea en la base los índices únicos "una firma por persona y documento" (PR de índice único de firmas).
# Uso (como root, en la VM):
#   indice-firmas-unicas.sh             solo REVISA: cuenta firmas duplicadas por tabla (no cambia nada)
#   indice-firmas-unicas.sh --aplicar   si no hay duplicadas, crea los 4 índices
# Crear un índice no borra ni modifica ninguna fila. Si hubiera duplicadas, NO crea nada y las muestra
# para revisarlas a mano. Después de crearlos, el «prisma db push» del despliegue ya no tiene nada que hacer.
set -euo pipefail

APLICAR=0; [ "${1:-}" = "--aplicar" ] && APLICAR=1
PSQL=(sudo -u postgres psql -P pager=off -v ON_ERROR_STOP=1 -d tramites)

echo "== Firmas duplicadas (misma persona, mismo documento) =="
DUP=$("${PSQL[@]}" -At <<'SQL'
SELECT
  (SELECT count(*) FROM (SELECT 1 FROM "FirmaExpedienteDocumento" GROUP BY "documentoId","usuarioId" HAVING count(*)>1) t) +
  (SELECT count(*) FROM (SELECT 1 FROM "FirmaDocumentoContrato"   GROUP BY "documentoId","usuarioId" HAVING count(*)>1) t) +
  (SELECT count(*) FROM (SELECT 1 FROM "Firma" WHERE "comunicacionId"     IS NOT NULL GROUP BY "comunicacionId","usuarioId"     HAVING count(*)>1) t) +
  (SELECT count(*) FROM (SELECT 1 FROM "Firma" WHERE "documentoArchivoId" IS NOT NULL GROUP BY "documentoArchivoId","usuarioId" HAVING count(*)>1) t);
SQL
)
echo "Casos duplicados: $DUP"
if [ "$DUP" != "0" ]; then
  "${PSQL[@]}" <<'SQL'
SELECT 'Trámites' AS modulo, "documentoId" AS documento, "usuarioId" AS usuario, count(*) FROM "FirmaExpedienteDocumento" GROUP BY 2,3 HAVING count(*)>1
UNION ALL SELECT 'GECON', "documentoId", "usuarioId", count(*) FROM "FirmaDocumentoContrato" GROUP BY 2,3 HAVING count(*)>1
UNION ALL SELECT 'Comunicación', "comunicacionId", "usuarioId", count(*) FROM "Firma" WHERE "comunicacionId" IS NOT NULL GROUP BY 2,3 HAVING count(*)>1
UNION ALL SELECT 'Archivo', "documentoArchivoId", "usuarioId", count(*) FROM "Firma" WHERE "documentoArchivoId" IS NOT NULL GROUP BY 2,3 HAVING count(*)>1;
SQL
  echo "Hay firmas duplicadas: no se crea ningún índice. Revíselas antes (no se borra nada automáticamente)."
  exit 1
fi

if [ "$APLICAR" = 0 ]; then
  echo "Sin duplicadas. Para crear los índices: $0 --aplicar"
  exit 0
fi

"${PSQL[@]}" <<'SQL'
CREATE UNIQUE INDEX IF NOT EXISTS "FirmaExpedienteDocumento_documentoId_usuarioId_key" ON "FirmaExpedienteDocumento"("documentoId", "usuarioId");
CREATE UNIQUE INDEX IF NOT EXISTS "FirmaDocumentoContrato_documentoId_usuarioId_key" ON "FirmaDocumentoContrato"("documentoId", "usuarioId");
CREATE UNIQUE INDEX IF NOT EXISTS "Firma_comunicacionId_usuarioId_key" ON "Firma"("comunicacionId", "usuarioId");
CREATE UNIQUE INDEX IF NOT EXISTS "Firma_documentoArchivoId_usuarioId_key" ON "Firma"("documentoArchivoId", "usuarioId");
SQL
echo "Índices creados."
