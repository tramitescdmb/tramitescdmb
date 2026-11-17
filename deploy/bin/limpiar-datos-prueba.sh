#!/bin/bash
# Borra los datos de prueba de producción, por grupos, con vista previa y copia previa.
# Uso (como root, en la VM):
#   limpiar-datos-prueba.sh tramites            Trámites ambientales 2.0 (expedientes, visitas, conceptos, firmas)
#   limpiar-datos-prueba.sh gecon               GECON (expedientes contractuales con sus documentos y firmas)
#   limpiar-datos-prueba.sh tramites,gecon      ambos
# Sin más argumentos solo MUESTRA lo que se borraría (hace el borrado y lo deshace). Con --ejecutar, pide
# confirmación, hace una copia de la base y borra de verdad.
# El SGDEA (comunicaciones) se limpia con el botón «Reiniciar datos de prueba» de Correspondencia → Administración.
# Nunca toca usuarios, perfiles, catálogos, TRD, SINCA 1.0, VITAL, SECOP (salvo la copia espejo de cada contrato borrado), contratistas, auditoría ni configuración:
# si el borrado alcanzara alguna de esas tablas, se cancela solo.
# Los archivos del NAS de lo borrado quedan sin referencia (ocupan disco, pero no se ven): se pueden limpiar después.
set -euo pipefail

GRUPOS="${1:-}"
EJECUTAR=0; [ "${2:-}" = "--ejecutar" ] && EJECUTAR=1
if [ -z "$GRUPOS" ]; then sed -n '2,12p' "$0"; exit 1; fi

SQL=/tmp/limpieza-prueba.sql
PROTEGIDAS="'Usuario','Cargo','UsuarioCargo','Perfil','PermisoPerfil','UsuarioPerfil','RolUsuario','Dependencia','TramiteTipo','DocumentoRequeridoDefinicion','Flujo','PasoDefinicion','FlujoTrabajo','PasoFlujo','TransicionPaso','SerieDocumental','SubserieDocumental','TipoDocumental','ConfiguracionSitio','SincaResolucion','SincaNitSnapshot','SincaSincronizacion','SolicitudVital','VitalTramite','VitalDescubrimiento','Contratista','RegistroAuditoria','CuentaCorreo','ClaveCorreo','PlantillaCorreo','TopeCuantiaContratacion','Tercero','Comunicacion','ExpedienteDocumental'"

borrados=""
IFS=',' read -ra LISTA <<< "$GRUPOS"
for g in "${LISTA[@]}"; do
  case "$g" in
    tramites) borrados+='DELETE FROM "Expediente";
DELETE FROM "Notificacion" WHERE "expedienteId" IS NOT NULL OR enlace LIKE '"'"'/expedientes/%'"'"' OR enlace LIKE '"'"'/tramites-ambientales/%'"'"';
' ;;
    gecon) borrados+='DELETE FROM "ExpedienteContractual";
DELETE FROM "Notificacion" WHERE enlace LIKE '"'"'/contratacion/%'"'"';
' ;;
    *) echo "Grupo desconocido: $g (use tramites, gecon o ambos separados por coma)"; exit 1 ;;
  esac
done

generar() {  # $1 = COMMIT | ROLLBACK
  cat > "$SQL" <<SQLEOF
\\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE antes AS SELECT table_name::text AS tabla,
  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint AS filas
  FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';
$borrados
CREATE TEMP TABLE despues AS SELECT table_name::text AS tabla,
  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint AS filas
  FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';
\\echo
\\echo === Registros que se borran, por tabla ===
SELECT a.tabla AS "Tabla", a.filas AS "Antes", d.filas AS "Después", a.filas - d.filas AS "Se borran"
  FROM antes a JOIN despues d USING (tabla) WHERE a.filas <> d.filas ORDER BY a.filas - d.filas DESC;
DO \$\$ BEGIN
  IF EXISTS (SELECT 1 FROM antes a JOIN despues d USING (tabla) WHERE a.filas <> d.filas AND a.tabla IN ($PROTEGIDAS)) THEN
    RAISE EXCEPTION 'El borrado alcanzaría una tabla protegida (usuarios, catálogos, SINCA, VITAL, SECOP, contratistas...). Se cancela.';
  END IF;
END \$\$;
$1;
SQLEOF
}

echo "== Vista previa (no se borra nada) =="
generar ROLLBACK
sudo -u postgres psql -P pager=off -d tramites -f "$SQL"

if [ "$EJECUTAR" = 0 ]; then
  echo; echo "Fue solo una vista previa. Para borrar de verdad: $0 $GRUPOS --ejecutar"; exit 0
fi

echo; echo "Se va a BORRAR lo de la lista de arriba en la base de producción."
read -r -p 'Escriba exactamente "BORRAR DATOS DE PRUEBA" para continuar: ' CONF
if [ "$CONF" != "BORRAR DATOS DE PRUEBA" ]; then echo "Cancelado, no se borró nada."; exit 1; fi

F=$(date -u +%Y%m%d-%H%M)
mkdir -p /var/backups/tramites
COPIA="/var/backups/tramites/antes-limpieza-$F.dump"
sudo -u postgres pg_dump -Fc -d tramites > "$COPIA"
chmod 600 "$COPIA"
echo "Copia previa guardada en $COPIA ($(du -h "$COPIA" | cut -f1))"

generar COMMIT
sudo -u postgres psql -P pager=off -d tramites -f "$SQL"
echo; echo "Listo: los datos de prueba se borraron. Para deshacerlo: pg_restore desde $COPIA."
