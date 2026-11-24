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

## Negocios Verdes por http (temporal)

Mientras no haya certificado, el bloque `listen 80` de `tramites` deja pasar por http solo el sitio
público de Negocios Verdes (y sus archivos `/_next/` e imágenes); el panel y el resto del SIC siguen
yendo a https. Aplicar en la VM (como root):

```bash
cp /home/administrador/tramites-http-nv.conf /etc/nginx/snippets/tramites-http-nv.conf
cp /home/administrador/tramites /etc/nginx/sites-available/tramites
nginx -t && systemctl reload nginx
```

Con el certificado: quitar esas `location` del bloque `listen 80` (que vuelva a ser solo
`return 301 https://$host$request_uri;`) y poner `URL_PUBLICA_NV="https://sic.cdmb.gov.co"`.
