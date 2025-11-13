# Tareas de Verificación Pendientes Post-Solución de Docker

Este documento describe los pasos necesarios para probar y validar las implementaciones de los **Hitos 2, 3 y 4**, que se desarrollaron "a ciegas" debido a la inactividad del entorno de Docker.

Una vez que el comando `sg docker -c "docker-compose up"` funcione correctamente, se deben seguir los siguientes casos de prueba en orden.

---

### Caso de Prueba 1: Hito 2 - Ciclo de Ejecución (Happy Path)

**Objetivo:** Verificar que un `prompt` para una habilidad existente (`sumar`) se procesa correctamente.

**Pasos:**
1.  **Levantar el Entorno:** Ejecutar `sg docker -c "docker-compose up --build"` y verificar que todos los servicios arrancan.
2.  **Enviar Tarea:** Usar un cliente de WebSocket para enviar el `prompt`: `"cuánto es 15 + 27"`.
3.  **Observar Logs del Orchestrator:** Verificar la secuencia de estados: `NUEVA` -> `ANALIZANDO_PROMPT` -> `EJECUTANDO_HABILIDAD` -> `COMPLETADA`. El resultado final en el log debe ser `42`.

---

### Caso de Prueba 2: Hitos 3 y 4 - Detección de Brecha y Planificación

**Objetivo:** Verificar que el sistema (Hito 3) detecta una habilidad faltante, y luego (Hito 4) genera un plan de desarrollo.

**Pasos:**
1.  **Entorno Activo:** Asegurarse de que el entorno del paso anterior sigue activo.
2.  **Enviar Tarea:** Usar el cliente de WebSocket para enviar el `prompt`: `"multiplica 5 por 3"`.
3.  **Observar Logs del Orchestrator:** Verificar la siguiente secuencia de estados:
    1.  `NUEVA` -> `ANALIZANDO_PROMPT` -> `BRECHA_CAPACIDAD_DETECTADA`
    2.  Log: `"Brecha de capacidad detectada. Habilidad faltante: 'multiplicar'"`
    3.  Log: `"Generando plan de desarrollo para la habilidad: multiplicar..."`
    4.  `Estado actualizado a: ESPERANDO_APROBACION_PLAN_DESARROLLO`
    5.  Log: `"Evento publicado: resultado.plan_desarrollo_generado"`
    6.  Log: `"Plan de desarrollo generado. Esperando aprobación del usuario."`

---

### Caso de Prueba 3: Manejo de Error (Prompt No Reconocido)

**Objetivo:** Asegurar que el sistema falla de forma controlada con un prompt que no entiende.

**Pasos:**
1.  **Enviar Tarea:** Usar el cliente de WebSocket para enviar un `prompt` no reconocido, por ejemplo: `"cuál es el clima de hoy"`.
2.  **Observar Logs del Orchestrator:** Verificar la secuencia de estados: `NUEVA` -> `ANALIZANDO_PROMPT` -> `FALLIDA_LOGICA`. El log debe mostrar un error como: `"Prompt no reconocido..."`.

---

Si todas estas verificaciones son exitosas, se podrá considerar que las implementaciones "a ciegas" de los Hitos 2, 3 y 4 son funcionales y correctas.
