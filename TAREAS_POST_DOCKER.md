# Tareas de Verificación Pendientes Post-Solución de Docker

Este documento describe los pasos necesarios para probar y validar las implementaciones de los **Hitos 2 y 3**, que se desarrollaron "a ciegas" debido a la inactividad del entorno de Docker.

Una vez que el comando `sg docker -c "docker-compose up"` funcione correctamente, se deben seguir los siguientes pasos en orden.

---

## Hito 2: Verificación del Ciclo de Ejecución

### 1. Happy Path (Habilidad 'sumar')

**Objetivo:** Verificar que un `prompt` para una habilidad existente (`sumar`) se procesa correctamente de principio a fin.

**Pasos:**
1.  **Levantar el Entorno:** Ejecutar `sg docker -c "docker-compose up --build"` y verificar que todos los servicios arrancan.
2.  **Enviar Tarea:** Usar un cliente de WebSocket para enviar el `prompt`: `"cuánto es 15 + 27"`.
3.  **Observar Logs del Orchestrator:** Verificar la siguiente secuencia de estados: `NUEVA` -> `ANALIZANDO_PROMPT` -> `EJECUTANDO_HABILIDAD` -> `COMPLETADA`. El resultado final en el log debe ser `42`.

---

## Hito 3: Verificación de Detección de Brecha de Capacidad

### 1. Happy Path (Detectar Habilidad 'multiplicar' Faltante)

**Objetivo:** Verificar que el sistema identifica correctamente una habilidad que no posee y transiciona al estado adecuado.

**Pasos:**
1.  **Entorno Activo:** Asegurarse de que el entorno del paso anterior sigue activo.
2.  **Enviar Tarea:** Usar el cliente de WebSocket para enviar el `prompt`: `"multiplica 5 por 3"`.
3.  **Observar Logs del Orchestrator:** Verificar la siguiente secuencia de estados: `NUEVA` -> `ANALIZANDO_PROMPT` -> `BRECHA_CAPACIDAD_DETECTADA`. El log debe mostrar el mensaje: `"Brecha de capacidad detectada. Habilidad faltante: 'multiplicar'"`.

### 2. Caso de Error (Prompt No Reconocido)

**Objetivo:** Asegurar que el sistema maneja correctamente los prompts que no se corresponden ni con una habilidad existente ni con una brecha de capacidad conocida.

**Pasos:**
1.  **Enviar Tarea:** Usar el cliente de WebSocket para enviar un `prompt` no reconocido, por ejemplo: `"cuál es el clima de hoy"`.
2.  **Observar Logs del Orchestrator:** Verificar la siguiente secuencia de estados: `NUEVA` -> `ANALIZANDO_PROMPT` -> `FALLIDA_LOGICA`. El log debe mostrar un error como: `"Prompt no reconocido..."`.

---

Si todas estas verificaciones son exitosas, se podrá considerar que las implementaciones "a ciegas" de los Hitos 2 y 3 son funcionales y correctas.
