# Aviso por correo cuando falla un proceso programado

Cuando una unidad falla, systemd llama a `tramites-falla@<unidad>.service`, que pide a la plataforma
enviar un correo a **tecnologia@cdmb.gov.co** (cambiable con `ALERTAS_SISTEMA_CORREO` en el `.env`,
varias direcciones separadas por coma). El correo sale por la cuenta institucional de la plataforma.

Instalar en la VM (como administrador):

```bash
sudo cp deploy/systemd/tramites-falla@.service /etc/systemd/system/
# Verificar que el puerto de la plataforma es el 3000 (si no, ajustar la línea ExecStart).
for u in $(systemctl list-unit-files 'tramites-*.service' --no-legend | awk '{print $1}' | grep -v '^tramites-falla@'); do
  sudo mkdir -p /etc/systemd/system/$u.d
  printf '[Unit]\nOnFailure=tramites-falla@%%n.service\n' | sudo tee /etc/systemd/system/$u.d/onfailure.conf >/dev/null
done
sudo systemctl daemon-reload
# Prueba (envía un correo real):
sudo systemctl start 'tramites-falla@prueba.service'
```

Limitación: el aviso sale por la propia plataforma. Si la plataforma está caída o el correo no está
configurado, no llega ningún mensaje; en ese caso hace falta una vigilancia externa (otro equipo que
consulte `https://<dominio>/login` cada pocos minutos).
