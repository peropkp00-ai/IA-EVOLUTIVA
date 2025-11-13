# Tareas de Verificación Pendientes Post-Solución de Docker

Este documento describe los pasos necesarios para probar y validar la implementación del **Hito 2: Ciclo de Ejecución**, que se desarrolló "a ciegas" debido a la inactividad del entorno de Docker.

Una vez que el comando `sg docker -c "docker-compose up"` funcione correctamente, se deben seguir los siguientes pasos.

## 1. Verificación del Flujo Completo ("Happy Path")

El objetivo es verificar que un `prompt` simple puede ser procesado de principio a fin por el `orchestrator-service`.

### Pasos de la Prueba:

1.  **Levantar el Entorno:**
    *   Ejecutar `sg docker -c "docker-compose up --build"` en la terminal.
    *   Verificar en los logs que los 6 servicios (event-bus, gateway, orchestrator, etc.) se inician sin errores.
    *   Verificar específicamente en el log del `orchestrator-service` que aparece el mensaje: `"Registro de habilidades cargado exitosamente."`.

2.  **Enviar una Tarea al Gateway:**
    *   Conectar un cliente de WebSocket al `gateway-service` (por defecto en `ws://localhost:3000`).
    *   Enviar un mensaje JSON con el siguiente formato, simulando la creación de una tarea:
        ```json
        {
          "tipo": "CREAR_TAREA",
          "payload": {
            "prompt": "cuánto es 15 + 27",
            "repositorioOrigen": "N/A"
          }
        }
        ```

3.  **Observar los Logs del Orchestrator:**
    *   Monitorizar en tiempo real los logs del `orchestrator-service`. Se espera ver la siguiente secuencia de transiciones de estado para la nueva tarea:
        1.  `Estado actualizado a: NUEVA`
        2.  `Estado actualizado a: ANALIZANDO_PROMPT`
        3.  `Estado actualizado a: EJECUTANDO_HABILIDAD`
        4.  `Resultado de la habilidad sumar: 42`
        5.  `Evento publicado: resultado.habilidad_ejecutada`
        6.  `Estado actualizado a: COMPLETADA`
        7.  `Tarea completada con resultado: 42`

## 2. Verificación de Casos de Error

El objetivo es asegurar que el sistema maneja correctamente los prompts que no entiende.

### Pasos de la Prueba:

1.  **Enviar un Prompt Inválido:**
    *   Usando el mismo cliente de WebSocket, enviar una nueva tarea con un `prompt` que la función `analizarPrompt` no pueda entender.
        ```json
        {
          "tipo": "CREAR_TAREA",
          "payload": {
            "prompt": "multiplica 5 por 3",
            "repositorioOrigen": "N/A"
          }
        }
        ```

2.  **Observar los Logs del Orchestrator:**
    *   Se espera ver la siguiente secuencia de logs para esta tarea:
        1.  `Estado actualizado a: ANALIZANDO_PROMPT`
        2.  Un mensaje de error: `Error en el ciclo de ejecución directa: No se pudo identificar una habilidad o los parámetros en el prompt.`
        3.  `Estado actualizado a: FALLIDA_LOGICA`

Si ambas verificaciones (el "Happy Path" y el caso de error) son exitosas, se podrá considerar que la implementación "a ciegas" del Hito 2 es funcional y correcta.
