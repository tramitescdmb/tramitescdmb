# nginx de la VM

`tramites` es copia exacta (más comentarios) de `/etc/nginx/sites-available/tramites` en la VM, tomada el
17-nov-2026. Es la única configuración habilitada.

Si se cambia en la VM, actualizar también esta copia. Para aplicar un cambio en la VM:

```bash
sudo cp deploy/nginx/tramites /etc/nginx/sites-available/tramites
sudo nginx -t && sudo systemctl reload nginx
```

Pendiente cuando exista el dominio y su certificado: cambiar `server_name`, las rutas del certificado y
agregar `Strict-Transport-Security`.
