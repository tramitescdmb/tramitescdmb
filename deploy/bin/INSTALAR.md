# Scripts de despliegue de la VM

`desplegar.sh` y `auto-desplegar.sh` viven en `/opt/tramites/bin/` de la VM. Aquí está la versión
guardada en el repositorio. No se actualizan solos: se copian a mano (a propósito, para que un cambio
en el repositorio no pueda dañar el propio mecanismo de despliegue).

Instalar o actualizar (como root en la VM, con la plataforma ya desplegada en `main`):

```bash
for f in desplegar.sh auto-desplegar.sh; do
  cp -a /opt/tramites/bin/$f /opt/tramites/bin/$f.$(date +%F-%H%M)    # copia de lo que hay
  cp /opt/tramites/app/deploy/bin/$f /opt/tramites/bin/$f
  chmod +x /opt/tramites/bin/$f
done
bash -n /opt/tramites/bin/desplegar.sh && bash -n /opt/tramites/bin/auto-desplegar.sh && echo "sintaxis ok"
```

Qué cambian respecto a la versión anterior:

- **Un solo despliegue a la vez** (candado), para que un manual y uno automático no se pisen.
- **Referencia del último commit desplegado con éxito** (`/opt/tramites/.desplegado`). Si un despliegue se
  interrumpe (Ctrl+C, corte de luz), el automático lo reintenta; antes se daba por hecho y quedaba apagado.
- **Dependencias:** se reinstalan si falta `node_modules` o cambió `package-lock.json` desde la última
  instalación completa, y también al volver atrás.
- **Cambios del esquema de la base:** el despliegue a mano los aplica con `prisma db push` (sin
  `--accept-data-loss`: si pudiera perder datos, se detiene y vuelve atrás). El automático NO despliega
  cambios de esquema: avisa por correo y espera un despliegue manual.
- **Vuelta atrás:** deja la rama puesta (no un commit suelto), reinstala las dependencias de la versión
  anterior y anota el commit que falló en `/opt/tramites/.despliegue-fallido`: no se reintenta hasta que
  llegue uno nuevo.
- **Comprobación final:** si tras reiniciar `/login` no responde 200, vuelve atrás.
- **Avisos:** un despliegue automático que falla sale con error y, con los avisos de
  `deploy/systemd/INSTALAR.md`, llega un correo. Si GitHub no responde por más de 1 hora, avisa una vez.
- **Copias previas** (`/var/backups/tramites/antes-desplegar-*.dump`): permiso 600 y se borran las de más de 60 días.
