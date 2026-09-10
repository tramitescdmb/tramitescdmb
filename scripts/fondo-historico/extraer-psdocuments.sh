#!/bin/bash
# Extractor del Fondo Documental histórico — psdocuments — vía sqlplus.
#
# Corre en el propio servidor Oracle (host `martin`, Oracle 10g). SOLO LECTURA.
# SOLO METADATOS (nunca toca las imágenes de 1,4 TB).
#
# Método: SQL*Plus NO genera JSON (cualquier comilla/salto lo rompía). Un bloque
# PL/SQL con DBMS_SQL recorre cada serie y emite los valores CRUDOS, uno por
# línea, en trozos de <=200 caracteres (tope de DBMS_OUTPUT en 10g), con marcas:
#   #<doc_iddocum>      → nuevo documento
#   @<NOMBRE_COLUMNA>   → empieza un campo
#   =<trozo del valor>  → (0..n líneas) contenido del campo
# El servidor (/api/fondo-historico/ingest, modo "dump") arma el JSON.
#
# Uso (como usuario `oracle`, o como root — el script fija ORACLE_HOME):
#   export FONDO_INGEST_URL="https://tramitescdmb.vercel.app/api/fondo-historico/ingest"
#   export FONDO_INGEST_TOKEN="…"
#   export FONDO_SERIES="101"            # opcional; sin esto, todas las series
#   bash extraer-psdocuments.sh

set -eu

: "${FONDO_INGEST_URL:?falta FONDO_INGEST_URL}"
: "${FONDO_INGEST_TOKEN:?falta FONDO_INGEST_TOKEN}"
ORA_USER="${FONDO_ORACLE_USER:-psidea1}"
ORA_PASS="${FONDO_ORACLE_PASSWORD:-psidea1}"
ORA_HOST="${FONDO_ORACLE_HOST:-192.168.7.40}"
ORA_PORT="${FONDO_ORACLE_PORT:-1521}"
ORA_SID="${FONDO_ORACLE_SID:-P}"
SCHEMA="${FONDO_ORACLE_SCHEMA:-C}"
CHUNK="${FONDO_CHUNK:-200}"          # documentos por bloque PL/SQL (tope buffer 1 MB)
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
[ -n "${ORACLE_HOME:-}" ] || ORACLE_HOME="$(cd "$(dirname "$SQLPLUS")/.." && pwd)"
export ORACLE_HOME
export LD_LIBRARY_PATH="$ORACLE_HOME/lib:${LD_LIBRARY_PATH:-}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

HDR='set pagesize 0
set feedback off
set heading off
set verify off
set echo off
set termout on
set linesize 400
set serveroutput on size 1000000 format truncated
alter session set nls_date_format = '"'"'YYYY-MM-DD'"'"';
whenever sqlerror exit sql.sqlcode'

runsql() { printf '%s\n%s\n' "$HDR" "$1" | "$SQLPLUS" -s -L "$CONN"; }

CURL_COMUN="-sS --http1.1 -4 --connect-timeout 20 --max-time 120"

ingest() { # $1 = cuerpo JSON corto
  printf '%s' "$1" > "$TMP/b.json"
  curl $CURL_COMUN -X POST "$FONDO_INGEST_URL" -H "Authorization: Bearer $FONDO_INGEST_TOKEN" \
    -H "Content-Type: application/json" --data-binary "@$TMP/b.json"
}
ingest_dump() { # $1 archivo de marcas, $2 sync, $3 serieId, $4 serieNombre
  curl $CURL_COMUN -w '\n@@HTTP %{http_code}@@\n' -X POST "$FONDO_INGEST_URL" \
    -H "Authorization: Bearer $FONDO_INGEST_TOKEN" -H "Content-Type: text/plain" \
    -H "Expect:" -H "X-Fondo: $FONDO" -H "X-Sync: $2" -H "X-Serie: $3" \
    -H "X-Serie-Nombre: $4" --data-binary "@$1"
}
json_val() { sed -n 's/.*"'"$1"'":\s*"\{0,1\}\([^",}]*\).*/\1/p'; }

echo "sqlplus: $SQLPLUS"
echo "Oracle:  ${ORA_USER}@${ORA_HOST}:${ORA_PORT}/${ORA_SID}  esquema ${SCHEMA}"

# --- 1. catálogo de series ---
runsql "select tip_idtipdo||chr(9)||tip_nombre from ${SCHEMA}.psidea_tipodoc
        where upper(tip_nombre) <> 'PRUEBA' order by tip_idtipdo;" \
  | grep -E '^[0-9]' | sed 's/[[:space:]]*$//' > "$TMP/series.tsv"

if [ -n "$SERIES_FILTRO" ]; then
  echo "$SERIES_FILTRO" | tr ', ' '\n' | grep -E '^[0-9]+$' | sort -u > "$TMP/filtro.txt"
  awk -F'\t' 'NR==FNR{k[$1]=1;next} ($1 in k)' "$TMP/filtro.txt" "$TMP/series.tsv" > "$TMP/s2" && mv "$TMP/s2" "$TMP/series.tsv"
fi
NSER=$(wc -l < "$TMP/series.tsv" | tr -d ' ')
echo "Series a extraer: $NSER"
[ "$NSER" -gt 0 ] || { echo "Nada que hacer."; exit 0; }

# --- 2. abrir la corrida ---
HOSTN="$(hostname 2>/dev/null || echo cdmb)"
SYNC="$(ingest "{\"fondo\":\"$FONDO\",\"disparadoPor\":\"script.sh:$HOSTN\"}" | json_val sincronizacionId)"
[ -n "$SYNC" ] || { echo "No pude abrir la corrida."; exit 1; }
echo "Corrida $SYNC"

TOTAL=0
SALTADAS=0

plsql() { # $1 serieId  $2 last-id  $3 limite
  cat <<SQL
declare
  cur integer; nc integer; cd dbms_sql.desc_tab; v varchar2(4000); ign integer;
  procedure pv(s in varchar2) is
    n integer; p integer := 1;
  begin
    if s is null then return; end if;
    n := length(s);
    if n = 0 then dbms_output.put_line('='); return; end if;
    while p <= n loop
      dbms_output.put_line('=' || regexp_replace(substr(s, p, 200), '[[:cntrl:]]', ' '));
      p := p + 200;
    end loop;
  end;
begin
  cur := dbms_sql.open_cursor;
  dbms_sql.parse(cur,
    'select d.*, '||
    '(select count(*) from ${SCHEMA}.psidea_version x where x.ver_iddocum = d.doc_iddocum '||
    ' and nvl(x.ver_estado,''X'') not in (''B'',''ND'')) as "__NARCH__", '||
    '(select max(x.ver_camino||x.ver_archivo) from ${SCHEMA}.psidea_version x '||
    ' where x.ver_iddocum = d.doc_iddocum) as "__RUTA__" '||
    'from (select * from ${SCHEMA}.psideaw_${1} where doc_iddocum > ${2} order by doc_iddocum) d '||
    'where rownum <= ${3}',
    dbms_sql.native);
  dbms_sql.describe_columns(cur, nc, cd);
  for i in 1..nc loop dbms_sql.define_column(cur, i, v, 4000); end loop;
  ign := dbms_sql.execute(cur);
  loop
    exit when dbms_sql.fetch_rows(cur) = 0;
    for i in 1..nc loop
      if cd(i).col_name = 'DOC_IDDOCUM' then
        dbms_sql.column_value(cur, i, v); dbms_output.put_line('#' || v);
      end if;
    end loop;
    for i in 1..nc loop
      if cd(i).col_name <> 'DOC_IDDOCUM' then
        dbms_sql.column_value(cur, i, v);
        dbms_output.put_line('@' || cd(i).col_name);
        pv(v);
      end if;
    end loop;
  end loop;
  dbms_sql.close_cursor(cur);
end;
/
SQL
}

PRIMERA=1
while IFS="$(printf '\t')" read -r SID SNOM; do
  [ -n "$SID" ] || continue
  LAST=0
  N=0
  while : ; do
    runsql "$(plsql "$SID" "$LAST" "$CHUNK")" > "$TMP/raw" 2>&1 || true
    grep -E '^[#@=]' "$TMP/raw" | sed 's/[[:space:]]*$//' > "$TMP/chunk"
    IDS=$(grep -c '^#' "$TMP/chunk" || true)
    if [ "$IDS" -eq 0 ]; then
      # ¿la consulta devolvió 0 filas (fin de la serie) o hubo un error?
      if grep -qiE 'ORA-|PLS-|SP2-|error' "$TMP/raw"; then
        echo; echo "== ERROR de SQL*Plus en PSIDEAW_${SID} (last=$LAST) =="
        cat "$TMP/raw" | head -30
        cp "$TMP/raw" /root/fondo-sqlplus-error.txt 2>/dev/null || cp "$TMP/raw" ./fondo-sqlplus-error.txt
        exit 1
      fi
      break
    fi
    RESP="$(ingest_dump "$TMP/chunk" "$SYNC" "$SID" "$SNOM")"
    HTTP="$(printf '%s' "$RESP" | sed -n 's/.*@@HTTP \([0-9]*\)@@.*/\1/p')"
    RESP="$(printf '%s' "$RESP" | sed 's/@@HTTP [0-9]*@@//')"
    if ! echo "$RESP" | grep -q '"recibidas"'; then
      echo; echo "== Fallo la ingesta (HTTP ${HTTP:-?}) =="
      echo "respuesta: ${RESP:-<vacía>}"
      cp "$TMP/chunk" /root/fondo-chunk-fallido.txt 2>/dev/null || cp "$TMP/chunk" ./fondo-chunk-fallido.txt
      echo "primeras líneas del bloque enviado:"; head -12 "$TMP/chunk"
      exit 1
    fi
    S=$(echo "$RESP" | json_val saltadas); SALTADAS=$((SALTADAS + ${S:-0}))
    N=$((N + IDS)); TOTAL=$((TOTAL + IDS))
    LAST=$(grep '^#' "$TMP/chunk" | sed 's/^#//' | sort -n | tail -1)
    if [ "$PRIMERA" = 1 ]; then
      PRIMERA=0
      echo "  (primer bloque OK: $RESP)"
    fi
    printf '\r  PSIDEAW_%s — %s: %s' "$SID" "$SNOM" "$N"
    [ "$IDS" -lt "$CHUNK" ] && break
  done
  echo
done < "$TMP/series.tsv"

# --- 3. cerrar ---
FIN="$(ingest "{\"fondo\":\"$FONDO\",\"sincronizacionId\":\"$SYNC\",\"finalizar\":true,\"totalOrigen\":$TOTAL}")"
[ "$SALTADAS" -gt 0 ] && echo "  ($SALTADAS filas se saltaron por formato)"
echo "Listo — $TOTAL documentos enviados. $FIN"
