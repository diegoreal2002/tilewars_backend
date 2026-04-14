# TileWars Backend - Operacion Strapi First

Objetivo: permitir cambios de negocio desde Strapi Admin sin tocar codigo.

## 1) Que puedes cambiar sin programar

- Reglas globales en **Game Settings** (`single type`):
  - tamaño del mapa
  - precio base
  - multiplicador VIP
  - ventana de ataque
  - porcentaje de mantenimiento
  - costos de defensa preparada por tipo
  - costo de escudo por hora
- Paquetes de pago en **Coin Package** (`collection type`):
  - nombre comercial
  - coins
  - precio USD
  - orden de visualizacion
  - activado/desactivado
- Contenido de casillas y perfiles desde sus colecciones.
- Auditar movimientos de saldo en **Coin Ledger**.

## 2) Flujo recomendado para preproduccion

1. Desplegar en Render con `render.yaml`.
2. Entrar a `/admin` y crear usuario administrador.
3. Configurar permisos en `Users & Permissions`:
   - publico: lectura de mapa/tiles segun necesidad.
   - autenticado: lectura y acciones de juego permitidas.
4. Crear registro unico en **Game Settings**.
5. Cargar paquetes en **Coin Package**.
6. Validar APIs desde frontend en entorno preprod.

## 2.1 Endpoint transaccional inicial disponible

Se incorporo un endpoint custom para iniciar integracion real con frontend:

- `POST /api/tiles/:id/buy-free`
- `POST /api/tiles/:id/attack`
- `POST /api/tiles/:id/outbid`
- `POST /api/tiles/:id/defend`
- `POST /api/tiles/:id/resolve`
- `POST /api/tiles/:id/prepared-defense`
- `POST /api/tiles/:id/shield`
- `POST /api/maintenance/run`

Comportamiento:

- Requiere usuario autenticado.
- Solo permite comprar casillas sin dueño.
- Toma el precio base desde `Game Settings.base_tile_price` (fallback 10).
- Debita `usua_nocoin` del perfil del jugador.
- Asigna dueño en la casilla y registra `tile_streak_start_at`.
- Crea registro de auditoria en `Coin Ledger`.

Ataque y outbid:

- `attack` inicia conflicto con ventana tomada desde `Game Settings.attack_window_hours`.
- `outbid` exige puja mayor a la maxima actual.
- Al ser superado un atacante:
  - se registra devolucion en `Coin Ledger` (`refund`)
  - se registra quema en `Burn Log`.

Defensa y cierre:

- `defend` permite contra-puja manual del owner durante la ventana activa.
- `resolve` permite cierre manual cuando expira la ventana.
- Adicionalmente existe worker automatico de cierre por tiempo.

Defensa preparada y escudos:

- `prepared-defense` configura tipo (`instant`, `m10`, `h1`, `h12`) y `cushion`.
- El costo se toma desde `Game Settings` y se debita upfront.
- `shield` compra proteccion de 1 a 168 horas.
- Durante escudo activo no se permiten ataques.

## 2.2 Worker de resolucion automatica

Variables de entorno:

- `ENABLE_CONFLICT_WORKER=true|false`
- `CONFLICT_RESOLUTION_INTERVAL_MS=10000` (minimo recomendado 3000)
- `MAINTENANCE_CHECK_INTERVAL_MS=3600000` (minimo recomendado 60000)
- `MAINTENANCE_RUN_TOKEN` (token para disparo manual de mantenimiento)

Funcion:

- Escanea casillas con conflicto vencido.
- Evalua triggers de defensa preparada antes del cierre.
- Ejecuta resolucion segun puja maxima atacante vs puja maxima defensiva.
- Registra burn/refund y limpia estado de conflicto en tile.
- Verifica si toca mantenimiento segun `maintenance_days_interval`.

Mantenimiento manual:

- Endpoint: `POST /api/maintenance/run`
- Header recomendado: `x-maintenance-token: <MAINTENANCE_RUN_TOKEN>`
- Ejecuta ciclo de mantenimiento inmediatamente.

## 3) Reglas de gobierno para cambios

- Cambios de economia se hacen solo en `Game Settings`.
- Cambios de monetizacion se hacen solo en `Coin Package`.
- Todo cambio en preprod debe quedar en changelog interno.
- No editar secretos ni variables sensibles desde codigo.

## 4) Lo que si requiere codigo (fase siguiente)

- Logica transaccional de ataques/defensas con locks.
- Webhooks PayPal idempotentes.
- Jobs de resolucion y mantenimiento.
- Auditoria de quema y reportes avanzados.

Esto mantiene el enfoque: backend centrado en Strapi, con maxima configuracion desde panel admin.

## 5) Estado de implementacion

Para ver avance real y pendientes del backend:

- `docs/BACKEND_IMPLEMENTATION_STATUS.md`
