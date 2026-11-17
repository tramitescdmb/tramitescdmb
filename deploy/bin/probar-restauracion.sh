#!/bin/bash
# Prueba que el último respaldo de la base se puede restaurar. NO toca la base de producción:
# crea una base temporal "tramites_prueba_restauracion", restaura ahí, compara y la borra.
# Uso (como root): probar-restauracion.sh [carpeta-de-respaldos]    (por defecto /var/backups/tramites)
set -euo pipefail

CARPETA="${1:-/var/backups/tramites}"
TEMPORAL=tramites_prueba_restauracion
DUMP=$(find "$CARPETA" -maxdepth 2 -name '*.dump' -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
if [ -z "$DUMP" ]; then echo "No hay respaldos .dump en $CARPETA"; exit 1; fi
echo "Respaldo: $DUMP ($(du -h "$DUMP" | cut -f1), $(date -r "$DUMP" '+%F %T'))"

sudo -u postgres dropdb --if-exists "$TEMPORAL"
sudo -u postgres createdb "$TEMPORAL"
trap 'sudo -u postgres dropdb --if-exists "$TEMPORAL" >/dev/null 2>&1 || true' EXIT

# pg_restore puede avisar de roles u objetos que no existen en la base temporal; lo que importa es el resultado.
sudo -u postgres pg_restore --no-owner --no-privileges -d "$TEMPORAL" "$DUMP" 2>"/tmp/restauracion-avisos.txt" || true
echo "Avisos de pg_restore: $(wc -l < /tmp/restauracion-avisos.txt) líneas (ver /tmp/restauracion-avisos.txt)"

contar() { sudo -u postgres psql -At -d "$1" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"; }
filas() {
  sudo -u postgres psql -At -d "$1" -c "ANALYZE" >/dev/null
  sudo -u postgres psql -At -d "$1" -c "SELECT coalesce(sum(n_live_tup),0)::bigint FROM pg_stat_user_tables"
}
T_PROD=$(contar tramites); T_REST=$(contar "$TEMPORAL")
F_PROD=$(filas tramites); F_REST=$(filas "$TEMPORAL")
echo "Tablas:  producción=$T_PROD  restaurada=$T_REST"
echo "Filas:   producción=$F_PROD  restaurada=$F_REST   (pueden diferir un poco: la producción sigue recibiendo datos)"
if [ "$T_PROD" = "$T_REST" ] && [ "$T_REST" -gt 0 ]; then echo "RESULTADO: el respaldo se restauró con todas sus tablas."; else echo "RESULTADO: REVISAR, el número de tablas no coincide."; exit 1; fi
