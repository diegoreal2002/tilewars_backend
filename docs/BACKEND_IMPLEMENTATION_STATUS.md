# TileWars Backend - Estado de Implementacion

Fecha de corte: Abril 2026

Este documento resume lo que ya esta implementado en backend y lo que falta para considerar produccion.

## 1) Estado actual (implementado)

### 1.1 Base de plataforma

- Backend con Strapi + TypeScript.
- Configuracion para Render preproduccion (`render.yaml`).
- Configuracion de `PUBLIC_URL`, proxy y CORS por variables de entorno.
- Build validado con `npm run build`.

### 1.2 Modelo Strapi-first (editable desde admin)

- `Game Settings` (single type):
  - reglas de economia y tiempos (precio base, ventana de ataque, costos de escudo, porcentajes de defensa preparada, etc.).
- `Coin Package` (collection type):
  - paquetes de compra de Coins configurables.
- `Tile` (collection type) extendido:
  - owner, precio real, estado de ataque, puja maxima atacante, puja maxima defensiva, escudo, defensa preparada.
- `Player Profile` (`usua`):
  - saldo entero de Coins y enlace con usuario de `users-permissions`.

### 1.3 Logica transaccional disponible (API)

- `POST /api/tiles/:id/buy-free`
  - compra de casilla libre usando `Game Settings.base_tile_price`.
- `POST /api/tiles/:id/attack`
  - inicia conflicto de ataque por ventana de tiempo.
- `POST /api/tiles/:id/outbid`
  - supera puja maxima atacante, con refund/burn del atacante superado.
- `POST /api/tiles/:id/defend`
  - contra-puja manual del owner.
- `POST /api/tiles/:id/resolve`
  - cierra conflicto manualmente (util para QA/admin en preprod).
- `POST /api/tiles/:id/prepared-defense`
  - configura defensa preparada (tipo + cushion, debito upfront).
- `POST /api/tiles/:id/shield`
  - compra escudo por horas (1-168), bloquea ataques durante vigencia.
- `POST /api/maintenance/run`
  - ejecuta mantenimiento manual con token de seguridad.

### 1.4 Auditoria y trazabilidad

- `Coin Ledger`:
  - registra debitos, refunds y movimientos economicos.
- `Burn Log`:
  - registra quema de Coins.
- `Attack Bid`:
  - historial de pujas de ataque por casilla.

### 1.5 Worker automatico

- Worker de conflictos por intervalo configurable:
  - procesa triggers de defensa preparada.
  - resuelve conflictos expirados.
  - revisa y ejecuta mantenimiento programado por intervalo de dias.
- Variables:
  - `ENABLE_CONFLICT_WORKER`
  - `CONFLICT_RESOLUTION_INTERVAL_MS`
  - `MAINTENANCE_CHECK_INTERVAL_MS`
  - `MAINTENANCE_RUN_TOKEN`

### 1.6 Mantenimiento (implementado)

- Cobro por casilla usando `maintenance_percent` en `Game Settings`.
- Frecuencia por `maintenance_days_interval`.
- Si saldo alcanza:
  - debito consolidado en `Coin Ledger` (`maintenance`).
- Si saldo no alcanza:
  - abandono de todas las casillas del usuario en el ciclo,
  - reset de datos de casilla a base,
  - registro en `Burn Log` para trazabilidad.
- Persistencia de control:
  - `Game Settings.last_maintenance_run_at`.

## 2) Pendiente para MVP completo (segun SRS)

### 2.1 Critico

- Integracion PayPal real:
  - creacion de orden,
  - captura,
  - webhook idempotente,
  - acreditacion de Coins en ledger.
- Hardening de permisos en `Users & Permissions` para cada endpoint custom.

### 2.2 Importante

- Endpoint de salud dedicado (`/_health` o equivalente) para monitoreo.
- Pruebas E2E basicas de flujo completo (buy/attack/outbid/defend/prepared-defense/shield/resolve).
- Reglas de concurrencia fuertes (locks transaccionales en operaciones sensibles).

## 3) Recomendacion de despliegue

- Mantener Render como preproduccion hasta completar los pendientes criticos.
- Subir a AWS produccion despues de:
  - mantenimiento quincenal listo,
  - PayPal webhook idempotente operativo,
  - permisos y pruebas E2E validados.

## 4) Fuentes relacionadas

- `docs/DEPLOY_RENDER_PREPROD.md`
- `docs/STRAPI_FIRST_OPERATIONS.md`
