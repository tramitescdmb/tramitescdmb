#!/bin/bash
# Extractor del Fondo Documental histórico — SIC correspondencia (PQR) — vía sqlplus.
#
# Corre en el propio servidor Oracle (host `martin`, Oracle 10g). SOLO LECTURA.
# A diferencia de psdocuments, el SIC SIGUE VIVO (COR_ATCREG recibe PQR a
# diario) — este extractor filtra por una VENTANA MÓVIL de los últimos
# FONDO_MESES meses (60 = 5 años por defecto), calculada en el propio Oracle
# con SYSDATE, así cada corrida se autoajusta: entra lo nuevo y se cae solo lo
# que ya envejeció fuera de la ventana (el `finalizar` del protocolo de
# ingesta borra lo que la corrida no volvió a tocar).
#
# Mismo método que extraer-psdocuments.sh: SQL*Plus NO arma JSON (rompía con
# comillas/saltos/líneas largas). Un bloque PL/SQL con DBMS_SQL emite los
# valores CRUDOS, uno por línea, en trozos de <=200 caracteres, con marcas:
#   #<numero_atc>       → nueva PQR
#   @<NOMBRE_COLUMNA>   → empieza un campo
#   =<trozo del valor>  → (0..n líneas) contenido del campo
# El servidor (/api/fondo-historico/ingest, modo "dump") arma el JSON.
#
# Uso (como root — el script fija ORACLE_HOME solo):
#   export FONDO_INGEST_URL="https://tramitescdmb.vercel.app/api/fondo-historico/ingest"
#   export FONDO_INGEST_TOKEN="…"
#   # export FONDO_MESES="48"   # opcional, 4 años en vez de 5
#   bash extraer-sic.sh
#
# Para dejarlo en cron diario (sincroniza lo nuevo, cae lo que envejece):
#   0 3 * * * FONDO_INGEST_URL=... FONDO_INGEST_TOKEN=... bash /root/extraer-sic.sh >> /root/fondo-sic.log 2>&1

set -eu

: "${FONDO_INGEST_URL:?falta FONDO_INGEST_URL}"
: "${FONDO_INGEST_TOKEN:?falta FONDO_INGEST_TOKEN}"
ORA_USER="${FONDO_ORACLE_USER:-psidea1}"
ORA_PASS="${FONDO_ORACLE_PASSWORD:-psidea1}"
ORA_HOST="${FONDO_ORACLE_HOST:-192.168.7.40}"
ORA_PORT="${FONDO_ORACLE_PORT:-1521}"
ORA_SID="${FONDO_ORACLE_SID:-P}"
SCHEMA="${FONDO_ORACLE_SCHEMA:-C}"
CHUNK="${FONDO_CHUNK:-200}"       # PQR por bloque PL/SQL (tope buffer DBMS_OUTPUT 1 MB)
MESES="${FONDO_MESES:-60}"       # ventana móvil: 60 = 5 años, 48 = 4 años
FONDO="sic-pqr"

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
[ -n "$SQLPLUS" ] || { echo "No encuentro sqlplus."; exit 1; }
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

# curl 7.19 (OL6) no conoce --http1.1 (y ya usa HTTP/1.1 por defecto).
CURL_COMUN="-sS --connect-timeout 20 --max-time 180"

ingest() { # $1 = cuerpo JSON corto
  printf '%s' "$1" > "$TMP/b.json"
  curl $CURL_COMUN -X POST "$FONDO_INGEST_URL" -H "Authorization: Bearer $FONDO_INGEST_TOKEN" \
    -H "Content-Type: application/json" --data-binary "@$TMP/b.json"
}
ingest_dump() { # $1 archivo de marcas, $2 sync
  curl $CURL_COMUN -w '\n@@HTTP %{http_code}@@\n' -X POST "$FONDO_INGEST_URL" \
    -H "Authorization: Bearer $FONDO_INGEST_TOKEN" -H "Content-Type: text/plain" \
    -H "Expect:" -H "X-Fondo: $FONDO" -H "X-Sync: $2" -H "X-Serie: 1" -H "X-Serie-Nombre: PQR" \
    --data-binary "@$1"
}
json_val() { sed -n 's/.*"'"$1"'":\s*"\{0,1\}\([^",}]*\).*/\1/p'; }

echo "sqlplus: $SQLPLUS"
echo "Oracle:  ${ORA_USER}@${ORA_HOST}:${ORA_PORT}/${ORA_SID}  esquema ${SCHEMA}"
echo "Ventana: últimos ${MESES} meses de COR_ATCREG"

# --- 1. abrir la corrida ---
HOSTN="$(hostname 2>/dev/null || echo cdmb)"
SYNC="$(ingest "{\"fondo\":\"$FONDO\",\"disparadoPor\":\"script.sh:$HOSTN\"}" | json_val sincronizacionId)"
[ -n "$SYNC" ] || { echo "No pude abrir la corrida."; exit 1; }
echo "Corrida $SYNC"

TOTAL=0
SALTADAS=0

plsql() { # $1 = ultimo numero_atc visto  $2 = limite del bloque
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
    'select * from (select * from ${SCHEMA}.cor_atcreg '||
    ' where numero_atc > ${1} and fecing_atc >= add_months(sysdate,-${MESES}) '||
    ' order by numero_atc) where rownum <= ${2}',
    dbms_sql.native);
  dbms_sql.describe_columns(cur, nc, cd);
  for i in 1..nc loop dbms_sql.define_column(cur, i, v, 4000); end loop;
  ign := dbms_sql.execute(cur);
  loop
    exit when dbms_sql.fetch_rows(cur) = 0;
    for i in 1..nc loop
      if cd(i).col_name = 'NUMERO_ATC' then
        dbms_sql.column_value(cur, i, v); dbms_output.put_line('#' || v);
      end if;
    end loop;
    for i in 1..nc loop
      if cd(i).col_name <> 'NUMERO_ATC' then
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
LAST=0
N=0
while : ; do
  runsql "$(plsql "$LAST" "$CHUNK")" > "$TMP/raw" 2>&1 || true
  grep -E '^[#@=]' "$TMP/raw" | sed 's/[[:space:]]*$//' > "$TMP/chunk"
  IDS=$(grep -c '^#' "$TMP/chunk" || true)
  if [ "$IDS" -eq 0 ]; then
    if grep -qiE 'ORA-|PLS-|SP2-|error' "$TMP/raw"; then
      echo; echo "== ERROR de SQL*Plus en COR_ATCREG (last=$LAST) =="
      cat "$TMP/raw" | head -30
      cp "$TMP/raw" /root/fondo-sqlplus-error.txt 2>/dev/null || cp "$TMP/raw" ./fondo-sqlplus-error.txt
      exit 1
    fi
    break
  fi
  RESP="$(ingest_dump "$TMP/chunk" "$SYNC")"
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
  printf '\r  COR_ATCREG: %s' "$N"
  [ "$IDS" -lt "$CHUNK" ] && break
done
echo

# --- 2. cerrar ---
FIN="$(ingest "{\"fondo\":\"$FONDO\",\"sincronizacionId\":\"$SYNC\",\"finalizar\":true,\"totalOrigen\":$TOTAL}")"
[ "$SALTADAS" -gt 0 ] && echo "  ($SALTADAS filas se saltaron por formato)"
echo "Listo — $TOTAL PQR enviadas. $FIN"
