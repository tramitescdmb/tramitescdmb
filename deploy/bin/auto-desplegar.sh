#!/bin/bash
# Lo llama el temporizador tramites-auto-desplegar cada 5 minutos: si la rama en uso cambió en
# GitHub, la despliega. Instalar en /opt/tramites/bin/ (ver deploy/bin/INSTALAR.md).
# - Si la VM quedó sin rama (HEAD suelto), vuelve a seguir main.
# - Un commit que ya falló no se reintenta hasta que llegue uno nuevo.
# - Los cambios del esquema de la base no se despliegan solos (hay que hacerlo a mano).
# - Si GitHub no responde por más de 1 hora, falla una sola vez (llega un aviso por correo).
set -euo pipefail

ESTADO=/opt/tramites
cd /opt/tramites/app
RAMA=$(sudo -u tramites git rev-parse --abbrev-ref HEAD)
if [ "$RAMA" = "HEAD" ]; then RAMA=main; fi

if ! REMOTO=$(sudo -u tramites git ls-remote origin "refs/heads/$RAMA" 2>/dev/null | cut -f1) || [ -z "$REMOTO" ]; then
  echo "No se pudo consultar GitHub"
  [ -f "$ESTADO/.sin-github" ] || date +%s > "$ESTADO/.sin-github"
  DESDE=$(cat "$ESTADO/.sin-github")
  if [ $(( $(date +%s) - DESDE )) -gt 3600 ] && [ ! -f "$ESTADO/.sin-github-avisado" ]; then
    touch "$ESTADO/.sin-github-avisado"
    echo "GitHub no responde desde hace más de 1 hora: la VM no puede actualizarse (¿falta la llave de lectura del repositorio?)."
    exit 1
  fi
  exit 0
fi
rm -f "$ESTADO/.sin-github" "$ESTADO/.sin-github-avisado"

# Se compara con el último commit DESPLEGADO con éxito, no con HEAD (un despliegue interrumpido deja
# HEAD en el commit nuevo con la compilación vieja). Si no hay registro, se asume que lo actual está desplegado.
if [ ! -f "$ESTADO/.desplegado" ]; then sudo -u tramites git rev-parse HEAD > "$ESTADO/.desplegado"; fi
LOCAL=$(cat "$ESTADO/.desplegado")
if [ "$REMOTO" = "$LOCAL" ]; then exit 0; fi
FALLIDO=$(cat "$ESTADO/.despliegue-fallido" 2>/dev/null || true)
if [ "$REMOTO" = "$FALLIDO" ]; then exit 0; fi

echo "Cambio en GitHub ($RAMA): ${LOCAL:0:8} -> ${REMOTO:0:8}"
exec env AUTOMATICO=1 /opt/tramites/bin/desplegar.sh "$RAMA"
