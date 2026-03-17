# CLAUDE.md — discord-checkin-bot

## Descripción del proyecto

Bot de Discord para comunidades de desarrolladores que permite registrar presencia activa en el equipo. Los miembros hacen check-in indicando hasta qué hora estarán disponibles y en qué proyecto están trabajando.

## Stack

- **Runtime:** Node.js >=18
- **Framework:** discord.js v14 (slash commands, buttons, modals)
- **Fechas/zonas horarias:** Luxon
- **Canvas:** @napi-rs/canvas (generación de imagen PNG server-side)
- **Despliegue:** Railway (via `railway.toml`, Dockerfile con `node:20-slim`)
- **Almacenamiento:** JSON en disco (`data/users.json`, `data/timezones.json`, `data/roster.json`)

## Estructura

```
src/
  index.js                  # Entry point: carga comandos, registra slash commands, arranca cliente
  commands/
    login.js                # /login — check-in con selector de hora (botones) + selector de proyecto
    logout.js               # /logout — cierra sesión activa
    project.js              # /project — cambia el proyecto activo sin re-login
    tracker.js              # /team — genera imagen visual del estado del equipo (canvas)
  handlers/
    interactionHandler.js   # Router central: slash commands, botones y modales
    expiryChecker.js        # Loop cada 60s que limpia sesiones expiradas y notifica
  utils/
    storage.js              # CRUD sobre data/*.json
    timeUtils.js            # Helpers de Luxon: getUpcomingHours, formatInZone, isExpired, hourLabel
    renderTracker.js        # Motor de canvas: genera el PNG del tracker (1280×720)
data/
  roster.json               # Roster fijo del equipo con colorIndex por miembro (no se edita en runtime)
  timezones.json            # Mapa userId→IANA timezone + clave "default"
  users.json                # Sesiones activas (ignorado en git)
```

> `deploy-commands.js` ya no es necesario — el registro de comandos ocurre automáticamente en el arranque (`index.js`).

## Comandos del bot

| Comando    | Descripción |
|------------|-------------|
| `/login`   | Check-in: elige hora (botones) → elige proyecto (botones con activos o texto libre) |
| `/logout`  | Cierra tu sesión activa |
| `/project` | Cambia de proyecto sin re-login (misma UI que /login: botones + texto libre) |
| `/team`    | Genera y envía una imagen visual del estado del equipo (canvas 1280×720) |

## Variables de entorno (`.env`)

| Variable        | Descripción                               |
|-----------------|-------------------------------------------|
| `DISCORD_TOKEN` | Token del bot                             |
| `CLIENT_ID`     | Application ID del bot en Discord         |
| `GUILD_ID`      | ID del servidor donde registrar comandos  |

## Flujo de /login y /project

1. Usuario ejecuta `/login` (o `/project`) → bot responde ephemeral con botones de hora (solo `/login`) o directamente con botones de proyecto.
2. Los botones de proyecto muestran todos los proyectos activos en ese momento. Si no hay ninguno, abre un modal de texto libre.
3. Hay siempre un botón "✏️ Nuevo proyecto" para introducir uno distinto.
4. Al confirmar, la sesión se guarda en `data/users.json` y se anuncia públicamente.

## Roster del equipo

`data/roster.json` define los 10 miembros fijos con su `colorIndex` (0–9). El orden determina su posición en el panel Offline del tracker.

```
0 Owel    → amarillo    5 Kappy   → azul
1 Nerwi   → amarillo    6 Bash    → verde
2 Bicarius→ rojo        7 Numpi   → morado
3 Tata    → azul        8 Bones   → morado
4 Thot    → azul        9 Raynor  → marrón
```

La coincidencia entre sesión activa y roster se hace por nombre (contains, case-insensitive).

## Gestión de zonas horarias

- Las zonas se leen de `data/timezones.json` (mapa `userId → IANA timezone`).
- Si un usuario no tiene zona configurada, se usa la clave `"default"` del JSON, o `"UTC"` como fallback.
- Para añadir o cambiar la zona de un usuario, editar `data/timezones.json` manualmente.

## Expiración automática

`expiryChecker.js` corre un `setInterval` cada 60 segundos. Cuando una sesión expira:
1. Se elimina de `users.json`.
2. Se envía un mensaje al canal donde el usuario hizo login.

## Despliegue en Railway

- Railway auto-despliega desde GitHub (rama `main`, root directory `discord-checkin-bot-main`).
- `railway.toml` usa `startCommand = "node src/index.js"` (sin `&&`).
- El Dockerfile usa `node:20-slim` (Debian/glibc) para compatibilidad con `@napi-rs/canvas`.
- Los slash commands se registran automáticamente en cada arranque — no hace falta ejecutar ningún script manualmente.

## Reglas de colaboración

- **No crear comandos de Discord nuevos sin consultarlo primero.** Presentar la propuesta antes de implementar.

## Notas de desarrollo

- `data/users.json` está en `.gitignore` — estado en runtime, no se versiona.
- El almacenamiento es en disco (JSON); los datos se pierden al reiniciar el contenedor en Railway (sin volumen persistente). Considerar migrar a base de datos si se necesita persistencia.
- Los comandos son guild-scoped (actualizaciones instantáneas, sin propagación de 1h).
