# TileWars Backend - Preproduccion en Render

Esta guia deja `tilewars_backend` en un entorno de preproduccion para pruebas funcionales antes de AWS.

## 1) Requisitos

- Repositorio del proyecto en GitHub.
- Cuenta en Render.
- Proyecto Strapi con `npm run build` funcionando en local.

## 2) Opcion recomendada (Blueprint con `render.yaml`)

1. Haz push de los cambios al repositorio.
2. En Render, entra a **New +** -> **Blueprint**.
3. Conecta tu repositorio y selecciona la rama de preproduccion.
4. Render detecta `render.yaml` y crea:
   - Servicio web `tilewars-backend-preprod`
   - Base de datos Postgres `tilewars-backend-preprod-db`
5. Verifica en el servicio web:
   - Build command: `npm ci && npm run build`
   - Start command: `npm run start`
6. Agrega manualmente `PUBLIC_URL` con la URL publica del servicio:
   - Ejemplo: `https://tilewars-backend-preprod.onrender.com`
7. Ejecuta deploy.

## 3) Variables de entorno minimas

Render genera automaticamente secretos en `render.yaml` para:

- `APP_KEYS`
- `API_TOKEN_SALT`
- `ADMIN_JWT_SECRET`
- `TRANSFER_TOKEN_SALT`
- `JWT_SECRET`
- `ENCRYPTION_KEY`

Variables importantes a confirmar:

- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `PORT=10000`
- `IS_PROXIED=true`
- `DATABASE_CLIENT=postgres`
- `DATABASE_URL=<fromDatabase>`
- `PUBLIC_URL=https://<tu-servicio>.onrender.com`
- `CORS_ORIGIN=https://<tu-frontend-preprod>.onrender.com`
- `ENABLE_CONFLICT_WORKER=true`
- `CONFLICT_RESOLUTION_INTERVAL_MS=10000`
- `MAINTENANCE_CHECK_INTERVAL_MS=3600000`
- `MAINTENANCE_RUN_TOKEN=<secreto-unico>`

## 4) Verificaciones post deploy

1. Salud del servicio:
   - `GET /admin` debe responder correctamente.
2. Admin de Strapi:
   - Abre `/admin` y crea el usuario admin inicial.
3. API:
   - Prueba `GET /api/tiles` y `GET /api/usuas`.
4. Logs:
   - Revisa que no haya errores de DB o secretos faltantes.

## 5) Flujo recomendado de ambientes

- `local`: desarrollo con sqlite o postgres local.
- `preprod-render`: validacion funcional y pruebas de integracion.
- `prod-aws`: salida final con infraestructura AWS.

## 6) Checklist previo a pasar a AWS

- [ ] Migraciones y modelos validados en Postgres.
- [ ] Variables sensibles solo en entorno (no en repo).
- [ ] CORS configurado para frontend de preproduccion.
- [ ] Pruebas basicas de autenticacion, compra, ataques y mantenimiento.
- [ ] Backups y monitoreo definidos para produccion.

## 7) Operacion sin codigo (Strapi-first)

Despues del deploy, usa esta guia para operar cambios de negocio desde Admin:

- `docs/STRAPI_FIRST_OPERATIONS.md`
- `docs/BACKEND_IMPLEMENTATION_STATUS.md`
