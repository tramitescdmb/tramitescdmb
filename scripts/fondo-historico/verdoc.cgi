#!/bin/sh
# Visor de escaneados de psdocuments para el Fondo histórico del SGDEA.
#
# Se instala como CGI de Apache EN PATEVACA (el servidor que tiene los archivos
# en /gestion). Recibe ?f=<ruta relativa bajo /gestion> y entrega el documento:
#   - TIFF (.001/.tif/.tiff, incl. multipágina) → convertido a PDF con tiff2pdf
#   - PDF                                        → tal cual
#   - otros                                      → descarga
#
# SOLO LECTURA. Solo sirve archivos bajo /gestion, rechaza `..`.
#
# Instalación (en patevaca, como root):
#   cp verdoc.cgi /var/www/cgi-bin/verdoc.cgi   # (o donde apunte ScriptAlias)
#   chmod 755 /var/www/cgi-bin/verdoc.cgi
#   service httpd reload
#   # probar:  curl -sI "http://192.168.7.70/cgi-bin/verdoc.cgi?f=Documentos/00000101/ADMINISTRADOR/00083608.001"
# Luego, en Vercel:  FONDO_PSDOCUMENTS_VISOR=http://192.168.7.70/cgi-bin/verdoc.cgi  y redesplegar.

BASE=/gestion

fail() { printf 'Status: %s\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n%s\n' "$1" "$2"; exit 0; }

# ?f=... url-encoded
val=$(printf '%s' "$QUERY_STRING" | sed -n 's/.*[?&]\{0,1\}f=\([^&]*\).*/\1/p')
rel=$(printf '%b' "$(printf '%s' "$val" | sed 's/+/ /g; s/%/\\x/g')")

case "$rel" in
  ""|*..*) fail 400 "solicitud invalida" ;;
esac
rel=${rel#/}
path="$BASE/$rel"
real=$(readlink -f "$path" 2>/dev/null || printf '%s' "$path")
case "$real" in
  "$BASE"/*) : ;;
  *) fail 403 "fuera de rango" ;;
esac
[ -f "$real" ] || fail 404 "el archivo no existe en el servidor"

nombre=$(basename "$real")
base=${nombre%.*}
lower=$(printf '%s' "$nombre" | tr 'A-Z' 'a-z')

case "$lower" in
  *.pdf)
    printf 'Content-Type: application/pdf\r\nContent-Disposition: inline; filename="%s"\r\n\r\n' "$nombre"
    cat "$real"
    ;;
  *.tif|*.tiff|*.[0-9][0-9][0-9])
    tmp=$(mktemp /tmp/verdoc.XXXXXX) || fail 500 "sin espacio temporal"
    if tiff2pdf -o "$tmp" "$real" 2>/dev/null && [ -s "$tmp" ]; then
      printf 'Content-Type: application/pdf\r\nContent-Disposition: inline; filename="%s.pdf"\r\n\r\n' "$base"
      cat "$tmp"
    else
      printf 'Content-Type: image/tiff\r\nContent-Disposition: attachment; filename="%s"\r\n\r\n' "$nombre"
      cat "$real"
    fi
    rm -f "$tmp"
    ;;
  *)
    printf 'Content-Type: application/octet-stream\r\nContent-Disposition: attachment; filename="%s"\r\n\r\n' "$nombre"
    cat "$real"
    ;;
esac
