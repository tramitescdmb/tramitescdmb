#!/bin/bash
# Endurece la VM: firewall (ufw), fail2ban, SSH solo con llave y permisos de los respaldos.
# Uso (como root):
#   endurecer-vm.sh <red-de-TI>            solo MUESTRA lo que haría (no cambia nada)
#   endurecer-vm.sh <red-de-TI> --aplicar  lo aplica
# <red-de-TI>: red desde la que se permite entrar por SSH, p. ej. 192.168.7.0/24 (incluye tu PC).
# Antes de apagar el ingreso por contraseña exige al menos 2 llaves registradas en administrador.
set -euo pipefail

RED="${1:-}"
APLICAR=0; [ "${2:-}" = "--aplicar" ] && APLICAR=1
if [ -z "$RED" ]; then echo "Falta la red de TI. Ej.: $0 192.168.7.0/24 [--aplicar]"; exit 1; fi

hacer() { echo "+ $*"; if [ "$APLICAR" = 1 ]; then "$@"; fi; }

LLAVES=$(grep -cE '^(ssh-|ecdsa-)' /home/administrador/.ssh/authorized_keys 2>/dev/null || true)
echo "Llaves SSH registradas para administrador: ${LLAVES:-0}"

echo "== Firewall =="
hacer apt-get install -y ufw
hacer ufw default deny incoming
hacer ufw default allow outgoing
hacer ufw allow from "$RED" to any port 22 proto tcp
hacer ufw allow 80/tcp
hacer ufw allow 443/tcp
hacer ufw --force enable

echo "== fail2ban =="
hacer apt-get install -y fail2ban
hacer systemctl enable --now fail2ban

echo "== Permisos de los respaldos (solo lectura para root/postgres) =="
hacer find /var/backups/tramites /mnt/nas/copias -name '*.dump' -exec chmod 600 {} +

echo "== SSH solo con llave =="
if [ "${LLAVES:-0}" -ge 2 ]; then
  if [ "$APLICAR" = 1 ]; then
    printf 'PasswordAuthentication no\nPermitRootLogin prohibit-password\n' > /etc/ssh/sshd_config.d/10-solo-llaves.conf
    sshd -t
    systemctl reload ssh
    echo "SSH ahora solo acepta llaves."
  else
    echo "+ (escribiría /etc/ssh/sshd_config.d/10-solo-llaves.conf con PasswordAuthentication no y recargaría ssh)"
  fi
else
  echo "OMITIDO: hacen falta al menos 2 llaves registradas (hay ${LLAVES:-0}); si no, podrías quedarte sin acceso."
fi

if [ "$APLICAR" = 0 ]; then echo; echo "Esto fue solo una simulación. Para aplicar: $0 $RED --aplicar"; fi
