#!/bin/bash
# Extractor del Fondo Documental histórico — psdocuments — VÍA sqlplus.
#
# Alternativa a extraer-psdocuments.mjs para cuando no hay un Node moderno ni
# cliente Oracle nuevo: corre en el propio servidor Oracle (host `martin`,
# Oracle 10g) usando `sqlplus` + `curl`, que ya están instalados.
#
# SOLO LECTURA sobre Oracle. SOLO METADATOS (no toca las imágenes).
#
# Uso (como usuario `oracle`, que tiene el entorno de Oracle cargado):
#   export FONDO_INGEST_URL="https://tramitescdmb.vercel.app/api/fondo-historico/ingest"
#   export FONDO_INGEST_TOKEN="…"
#   export FONDO_SERIES="262,264"        # opcional, para un piloto
#   bash extraer-psdocuments.sh
#
# Si se corre como root:  su - oracle -c 'FONDO_INGEST_URL=… FONDO_INGEST_TOKEN=… bash /ruta/extraer-psdocuments.sh'

set -eu

: "${FONDO_INGEST_URL:?falta FONDO_INGEST_URL}"
: "${FONDO_INGEST_TOKEN:?falta FONDO_INGEST_TOKEN}"
ORA_USER="${FONDO_ORACLE_USER:-psidea1}"
ORA_PASS="${FONDO_ORACLE_PASSWORD:-psidea1}"
ORA_HOST="${FONDO_ORACLE_HOST:-192.168.7.40}"
ORA_PORT="${FONDO_ORACLE_PORT:-1521}"
ORA_SID="${FONDO_ORACLE_SID:-P}"
SCHEMA="${FONDO_ORACLE_SCHEMA:-C}"
LOTE="${FONDO_LOTE:-500}"
SERIES_FILTRO="${FONDO_SERIES:-}"
FONDO="psdocuments"

CONN="${ORA_USER}/${ORA_PASS}@(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${ORA_HOST})(PORT=${ORA_PORT}))(CONNECT_DATA=(SID=${ORA_SID})))"

SQLPLUS="$(command -v sqlplus || true)"
if [ -z "$SQLPLUS" ]; then
  for d in /u01/app/oracle/product/*/*/bin /u01/app/oracle/product/*/bin /opt/oracle/*/bin; do
    if [ -x "$d/sqlplus" ]; then
      SQLPLUS="$d/sqlplus"; ORACLE_HOME="${d%/bin}"; export ORACLE_HOME
      export LD_LIBRARY_PATH="$ORACLE_HOME/lib:${LD_LIBRARY_PATH:-}"; break
    fi
  done
fi
[ -n "$SQLPLUS" ] || { echo "No encuentro sqlplus. Corre el script como el usuario 'oracle'."; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

SET_OPTS='set pagesize 0 feedback off heading off verify off echo off newpage none
set linesize 32767 long 2000000 longchunksize 2000000 trimspool on trimout on tab off
whenever sqlerror exit sql.sqlcode'

# Ejecuta el SQL de $1 y deja la salida en stdout (sin adornos).
runsql() { printf '%s\n%s\n' "$SET_OPTS" "$1" | "$SQLPLUS" -s -L "$CONN"; }

# --- curl al endpoint de ingesta. El cuerpo se pasa por archivo (los lotes
#     pueden pesar cientos de KB y no caben como argumento). ---
ingest_file() { # $1 = archivo con el cuerpo JSON
  curl -sS -X POST "$FONDO_INGEST_URL" \
    -H "Authorization: Bearer $FONDO_INGEST_TOKEN" \
    -H "Content-Type: application/json" \
    --data-binary "@$1"
}
ingest() { # $1 = cuerpo JSON corto
  printf '%s' "$1" > "$TMP/body.json"; ingest_file "$TMP/body.json"
}
json_val() { # extrae "clave":"valor" de un JSON plano
  sed -n 's/.*"'"$1"'":"\([^"]*\)".*/\1/p'
}

echo "sqlplus: $SQLPLUS"
echo "Oracle:  ${ORA_USER}@${ORA_HOST}:${ORA_PORT}/${ORA_SID}  esquema ${SCHEMA}"

# --- 1. catálogo de series ---
runsql "select tip_idtipdo||chr(9)||tip_nombre from ${SCHEMA}.psidea_tipodoc
        where upper(tip_nombre) <> 'PRUEBA' order by tip_idtipdo;" \
  | grep -E '^[0-9]' > "$TMP/series.tsv"

if [ -n "$SERIES_FILTRO" ]; then
  echo "$SERIES_FILTRO" | tr ',' '\n' | sed 's/ //g' | sort -u > "$TMP/filtro.txt"
  awk -F'\t' 'NR==FNR{keep[$1]=1;next} ($1 in keep)' "$TMP/filtro.txt" "$TMP/series.tsv" > "$TMP/series2.tsv"
  mv "$TMP/series2.tsv" "$TMP/series.tsv"
fi
NSER=$(wc -l < "$TMP/series.tsv" | tr -d ' ')
echo "Series a extraer: $NSER"
[ "$NSER" -gt 0 ] || { echo "Nada que hacer."; exit 0; }

# --- 2. abrir la corrida ---
HOSTN="$(hostname 2>/dev/null || echo cdmb)"
RESP="$(ingest "{\"fondo\":\"$FONDO\",\"disparadoPor\":\"script.sh:$HOSTN\"}")"
SYNC="$(echo "$RESP" | json_val sincronizacionId)"
[ -n "$SYNC" ] || { echo "No pude abrir la corrida: $RESP"; exit 1; }
echo "Corrida $SYNC"

TOTAL=0

# --- 3. por serie: generar la consulta que emite un JSON por documento ---
while IFS="$(printf '\t')" read -r SID SNOM; do
  [ -n "$SID" ] || continue
  SNOM_ESC="$(printf '%s' "$SNOM" | sed 's/\\/\\\\/g; s/"/\\"/g')"

  # columnas de la tabla de la serie (nombre \t tipo)
  COLS="$(runsql "select column_name||chr(9)||data_type from all_tab_columns
                  where owner='${SCHEMA}' and table_name='PSIDEAW_${SID}' order by column_id;")"
  [ -n "$COLS" ] || { echo "  (serie $SID sin tabla PSIDEAW_${SID}, la omito)"; continue; }

  CAMPOS=""
  while IFS="$(printf '\t')" read -r CN CT; do
    [ -n "$CN" ] || continue
    [ "$CN" = "DOC_IDDOCUM" ] && continue
    case "$CT" in
      *DATE*) VAL="case when d.${CN} is null then 'null' else '\"'||to_char(d.${CN},'YYYY-MM-DD')||'\"' end" ;;
      *) VAL="case when d.${CN} is null then 'null' else '\"'||replace(replace(replace(replace(replace(ltrim(to_char(d.${CN})),'\\','\\\\'),'\"','\\\"'),chr(13),' '),chr(10),' '),chr(9),' ')||'\"' end" ;;
    esac
    FRAG="'\"${CN}\":'||${VAL}"
    if [ -z "$CAMPOS" ]; then CAMPOS="$FRAG"; else CAMPOS="${CAMPOS}||','||${FRAG}"; fi
  done <<EOF
$COLS
EOF

  SQL="select to_clob('{\"ref_id\":\"')||ltrim(to_char(d.doc_iddocum))||'\",'
    ||'\"serie_id\":${SID},\"serie_nombre\":\"${SNOM_ESC}\",'
    ||'\"num_archivos\":'||ltrim(to_char(nvl(vv.n,0)))||','
    ||'\"tiene_imagen\":'||case when nvl(vv.n,0)>0 then 'true' else 'false' end||','
    ||'\"ruta_original\":'||case when vv.ruta is null then 'null' else '\"'||replace(replace(vv.ruta,'\\','\\\\'),'\"','\\\"')||'\"' end||','
    ||'\"campos\":{'||${CAMPOS}||'}}'
    from ${SCHEMA}.psideaw_${SID} d
    left join (select ver_iddocum, count(*) n, max(ver_camino||ver_archivo) ruta
               from ${SCHEMA}.psidea_version
               where nvl(ver_estado,'X') not in ('B','ND')
               group by ver_iddocum) vv on vv.ver_iddocum = d.doc_iddocum;"

  runsql "$SQL" | grep '^{' >> "$TMP/todo.jsonl" || true
  N=$(grep -c '^{' "$TMP/todo.jsonl" 2>/dev/null || echo 0)
  echo "  PSIDEAW_${SID} — ${SNOM}  (acumulado ${N})"
done < "$TMP/series.tsv"

[ -s "$TMP/todo.jsonl" ] || { echo "Sin filas."; ingest "{\"fondo\":\"$FONDO\",\"sincronizacionId\":\"$SYNC\",\"finalizar\":true}" >/dev/null; exit 0; }

# --- 4. subir por lotes ---
# -a 6: sufijos largos (con lotes de 300 y series de cientos de miles de filas,
# los 676 sufijos de 2 letras por defecto no alcanzan).
split -l "$LOTE" -a 6 "$TMP/todo.jsonl" "$TMP/lote_"
for f in "$TMP"/lote_*; do
  { printf '{"fondo":"%s","sincronizacionId":"%s","lote":[' "$FONDO" "$SYNC"
    paste -sd, "$f"
    printf ']}'
  } > "$TMP/body.json"
  OUT="$(ingest_file "$TMP/body.json")"
  echo "$OUT" | grep -q '"recibidas"' || { echo "Fallo un lote: $OUT"; exit 1; }
  TOTAL=$((TOTAL + $(wc -l < "$f")))
  printf '\r  subidas %s' "$TOTAL"
done
echo

# --- 5. cerrar ---
FIN="$(ingest "{\"fondo\":\"$FONDO\",\"sincronizacionId\":\"$SYNC\",\"finalizar\":true,\"totalOrigen\":$TOTAL}")"
echo "Listo — $TOTAL filas enviadas. $FIN"
