#!/bin/bash
# Despliega la plataforma en la VM.
# Uso: desplegar.sh [rama]    (sin argumento: la rama en uso; si no hay rama, main)
# Instalar en /opt/tramites/bin/ (ver deploy/bin/INSTALAR.md). Corre como root.
#
# Lo que hace: baja el código, copia la base, reinstala dependencias si hace falta, aplica los
# cambios de la base (prisma db push, sin perder datos), compila, reinicia y comprueba la plataforma.
# Si algo falla, vuelve a la versión anterior y deja anotado el commit que falló para que el
# despliegue automático no lo reintente hasta que llegue uno nuevo. El último commit desplegado con
# éxito queda en /opt/tramites/.desplegado; si el despliegue se interrumpe (Ctrl+C, corte), el
# automático lo reintenta en el siguiente ciclo.
# Con AUTOMATICO=1 (lo pone auto-desplegar.sh) NO se despliegan cambios del esquema de la base.
set -euo pipefail

APP=/opt/tramites/app
ESTADO=/opt/tramites
RESPALDOS=/var/backups/tramites
cd "$APP"

exec 9>/var/lock/tramites-desplegar.lock
if ! flock -n 9; then echo "Ya hay un despliegue en curso."; exit 1; fi

git_app() { sudo -u tramites git "$@"; }

ACTUAL=$(git_app rev-parse --abbrev-ref HEAD)
if [ "$ACTUAL" = "HEAD" ]; then ACTUAL=main; fi
RAMA="${1:-$ACTUAL}"
# ANTES = último commit desplegado con éxito (no el HEAD: si un despliegue se interrumpió, HEAD ya
# apunta al commit nuevo pero la plataforma sigue con la compilación vieja).
ANTES=$(cat "$ESTADO/.desplegado" 2>/dev/null || git_app rev-parse HEAD)
git_app fetch origin "$RAMA"
DESPUES=$(git_app rev-parse FETCH_HEAD)
# Cualquier fallo a partir de aquí (copia de la base, npm ci...) anota el commit para que el automático
# no lo reintente cada 5 minutos. Una interrupción (Ctrl+C, kill: código >= 128) NO se anota: se reintenta.
trap 'rc=$?; if [ "$rc" -ne 0 ] && [ "$rc" -lt 128 ]; then echo "$DESPUES" > "$ESTADO/.despliegue-fallido"; fi' EXIT

CAMBIA_ESQUEMA=0
if ! git_app diff --quiet "$ANTES" "$DESPUES" -- prisma/schema.prisma; then CAMBIA_ESQUEMA=1; fi
if [ "$CAMBIA_ESQUEMA" = 1 ] && [ "${AUTOMATICO:-0}" = 1 ]; then
  echo "$DESPUES" > "$ESTADO/.despliegue-fallido"
  echo "El cambio ${DESPUES:0:8} modifica el esquema de la base: se despliega a mano con: sudo $ESTADO/bin/desplegar.sh $RAMA"
  exit 1
fi

instalar_dependencias() {
  local hash
  hash=$(sha256sum package-lock.json | cut -d' ' -f1)
  if [ ! -d node_modules ] || [ "$(cat "$ESTADO/.deps-hash" 2>/dev/null || true)" != "$hash" ]; then
    rm -f "$ESTADO/.deps-hash"
    sudo -u tramites bash -lc "cd $APP && npm ci" || return 1
    echo "$hash" > "$ESTADO/.deps-hash"
  fi
}

COPIA_NEXT=0   # 1 cuando ya se guardó la compilación actual en .next-anterior (solo entonces hay algo que restaurar)
volver_atras() {
  echo "$1"
  echo "$DESPUES" > "$ESTADO/.despliegue-fallido"
  git_app checkout -q -B "$ACTUAL" "$ANTES"
  instalar_dependencias
  if [ "$COPIA_NEXT" = 1 ] && [ -d "$ESTADO/.next-anterior" ]; then
    rm -rf .next
    cp -a "$ESTADO/.next-anterior" .next
    chown -R tramites:tramites .next
  fi
  systemctl restart tramites
  exit 1
}

git_app checkout -q -B "$RAMA" "$DESPUES"
echo "Código: ${ANTES:0:8} -> ${DESPUES:0:8} ($RAMA)"

F=$(date -u +%Y%m%d-%H%M)
mkdir -p "$RESPALDOS"
sudo -u postgres pg_dump -Fc -d tramites > "$RESPALDOS/antes-desplegar-$F.dump" || volver_atras "ERROR al copiar la base de datos. Se vuelve a la versión anterior."
chmod 600 "$RESPALDOS/antes-desplegar-$F.dump"

instalar_dependencias || volver_atras "ERROR al instalar las dependencias. Se vuelve a la versión anterior."

if [ "$CAMBIA_ESQUEMA" = 1 ]; then
  echo "Cambió prisma/schema.prisma: se aplica con prisma db push (sin --accept-data-loss: si pudiera perder datos, se detiene)."
  sudo -u tramites bash -lc "cd $APP && npx prisma db push" || volver_atras "ERROR al aplicar el cambio de esquema. Se vuelve a la versión anterior."
fi

rm -rf "$ESTADO/.next-anterior"
if [ -d .next ]; then cp -a .next "$ESTADO/.next-anterior"; COPIA_NEXT=1; fi
if sudo -u tramites bash -lc "cd $APP && npx prisma generate >/dev/null && npm run build" > "/tmp/desplegar-$F.log" 2>&1; then
  systemctl restart tramites
  sleep 5
  CODIGO=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/login || true)
  echo "Plataforma: HTTP $CODIGO"
  if [ "$CODIGO" != "200" ]; then volver_atras "ERROR: la plataforma no respondió 200 al reiniciar. Se vuelve a la versión anterior."; fi
  echo "$DESPUES" > "$ESTADO/.desplegado"
  rm -f "$ESTADO/.despliegue-fallido"
else
  volver_atras "ERROR en la compilación (ver /tmp/desplegar-$F.log). Se vuelve a la versión anterior."
fi

# Copias previas a un despliegue: se conservan 60 días.
find "$RESPALDOS" -name 'antes-desplegar-*.dump' -mtime +60 -delete || true
