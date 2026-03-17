# CLAUDE.md — discord-checkin-bot

## Descripción del proyecto

Bot de Discord para comunidades de desarrolladores que permite registrar presencia activa en el equipo. Los miembros hacen check-in indicando hasta qué hora estarán disponibles y en qué proyecto están trabajando.

## Stack

- **Runtime:** Node.js >=18
- **Framework:** discord.js v14 (slash commands, buttons, modals)
- **Fechas/zonas horarias:** Luxon
- **Despliegue:** Railway (via `railway.toml`)
- **Contenedorización:** Dockerfile disponible
- **Almacenamiento:** JSON en disco (`data/users.json`, `data/timezones.json`)

## Estructura

```
src/
  index.js                  # Entry point: carga comandos, arranca cliente Discord
  commands/
    login.js                # /login — check-in con selector de hora (botones) + modal de proyecto
    logout.js               # /logout — cierra sesión activa
    project.js              # /project — cambia el proyecto activo sin re-login
    team.js                 # /team — lista quién está en línea
  handlers/
    interactionHandler.js   # Router central: slash commands, botones y modales
    expiryChecker.js        # Loop cada 60s que limpia sesiones expiradas y notifica
  utils/
    storage.js              # CRUD sobre data/users.json y data/timezones.json
    timeUtils.js            # Helpers de Luxon: getUpcomingHours, formatInZone, isExpired, hourLabel
data/
  timezones.json            # Mapa userId→IANA timezone + clave "default"
  users.json                # Sesiones activas (ignorado en git)
deploy-commands.js          # Script one-shot para registrar slash commands en Discord
```

## Variables de entorno (`.env`)

| Variable       | Descripción                               |
|----------------|-------------------------------------------|
| `DISCORD_TOKEN`| Token del bot                             |
| `CLIENT_ID`    | Application ID del bot en Discord         |
| `GUILD_ID`     | ID del servidor donde registrar comandos  |

## Comandos npm

```bash
npm start          # Arranca el bot (node src/index.js)
npm run deploy     # Registra slash commands en Discord (ejecutar una sola vez por cambio)
```

## Flujo de /login

1. Usuario ejecuta `/login` → bot responde ephemeral con 8 botones de hora (próximas 8 horas completas en UTC, mostradas en la zona del usuario).
2. Usuario pulsa un botón → bot abre un Modal pidiendo el nombre del proyecto.
3. Usuario envía el modal → bot guarda la sesión en `data/users.json` y responde públicamente.

## Gestión de zonas horarias

- Las zonas se leen de `data/timezones.json` (mapa `userId → IANA timezone`).
- Si un usuario no tiene zona configurada, se usa la clave `"default"` del JSON, o `"UTC"` como fallback.
- Para añadir o cambiar la zona de un usuario, editar `data/timezones.json` manualmente (no hay comando de bot para esto todavía).

## Expiración automática

`expiryChecker.js` corre un `setInterval` cada 60 segundos. Cuando una sesión expira:
1. Se elimina de `users.json`.
2. Se envía un mensaje al canal donde el usuario hizo login.

## Estado pendiente (to-do.txt)

- Invitar el bot al servidor con la URL OAuth2 del `to-do.txt`.
- Ejecutar `node deploy-commands.js` una vez para registrar los 4 slash commands.
- Desplegar en Railway: push del repo + configurar las 3 variables de entorno en el dashboard.

## Reglas de colaboración

- **No crear comandos de Discord nuevos sin consultarlo primero.** Antes de implementar una solución que implique un comando nuevo, presentar la propuesta y recoger feedback.

## Notas de desarrollo

- `data/users.json` está en `.gitignore` — es estado en tiempo de ejecución, no se versiona.
- El almacenamiento es en disco (JSON); en entornos efímeros (Railway sin volumen persistente) los datos se pierden al reiniciar. Considerar migrar a una base de datos si se necesita persistencia.
- Los comandos de Discord son guild-scoped (no globales), lo que permite actualizaciones instantáneas sin esperar la propagación de 1 hora de los comandos globales.
