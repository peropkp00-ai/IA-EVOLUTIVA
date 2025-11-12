# Contratos de Comunicación

Este documento define el protocolo de comunicación interna y externa del sistema, según lo establecido en la **Fase 0** del plan de desarrollo. Todos los servicios deben adherirse estrictamente a estos contratos para garantizar la interoperabilidad.

---

## 1. Nomenclatura del `event-bus`

Se establece una nomenclatura estandarizada para los temas (topics) o colas del bus de eventos.

- **`topico.tareas`**: En este tópico se publican todos los eventos que representan una **orden** o solicitud de trabajo para un servicio.
- **`topico.resultados`**: En este tópico se publican todos los eventos que representan la **conclusión** o el resultado de un trabajo.
- **`topico.logs`**: En este tópico se publican todos los eventos de telemetría y logs estructurados.

---

## 2. Esquemas de Mensajes (Eventos)

Cada mensaje (evento) que viaja a través del `event-bus` debe ser un JSON que cumpla con la siguiente estructura.

### 2.1 Estructura de Metadatos (Obligatoria)

Todo evento, sin excepción, debe contener un bloque `metadata` para el rastreo y la auditoría del flujo completo.

```json
{
  "metadata": {
    "taskId": "string",       // ID único de la tarea principal. Persiste en todo el ciclo de vida.
    "traceId": "string",      // ID único para este evento específico.
    "timestamp": "string",    // Marca de tiempo en formato ISO 8601 (UTC).
    "originator": "string"    // Nombre del servicio que emite el evento (ej. "gateway-service").
  },
  "payload": {
    // ... contenido específico del evento
  }
}
```

### 2.2 Eventos de Tareas (`topico.tareas`)

A continuación se definen los *payloads* para los eventos que representan órdenes.

- **`tarea.crear`**: Inicia una nueva tarea en el sistema.
  ```json
  {
    "prompt": "string",
    "repositorioOrigen": "string",
    "reglas": {
      "requiereAprobacionPlan": "boolean"
    }
  }
  ```
- **`tarea.generar_plan`**: Solicita al agente la creación de un plan de ejecución.
  ```json
  {
    "prompt": "string"
  }
  ```
- **`tarea.aprobar_plan`**: Notifica la aprobación de un plan para que el agente comience la ejecución.
  ```json
  {
    "planId": "string"
  }
  ```
- **`tarea.consultar_estado`**: Solicita un informe de estado a un servicio de larga duración.
  ```json
  {
    "sessionId": "string" // ID de la sesión del agente a consultar.
  }
  ```
- **`tarea.enviar_feedback`**: Envía una corrección o feedback al agente.
  ```json
  {
    "sessionId": "string",
    "promptCorreccion": "string"
  }
  ```
- **`tarea.probar_integracion`**: Solicita al `sandbox-service` que pruebe una Pull Request.
  ```json
  {
    "pullRequestUrl": "string"
  }
  ```

### 2.3 Eventos de Resultados (`topico.resultados`)

A continuación se definen los *payloads* para los eventos que representan resultados.

- **`resultado.plan_generado`**: Publicado cuando el agente ha creado un plan.
  ```json
  {
    "planId": "string",
    "plan": {} // Objeto JSON que representa el plan.
  }
  ```
- **`resultado.estado_actualizado`**: Publicado como respuesta a una `tarea.consultar_estado` o como "heartbeat".
  ```json
  {
    "sessionId": "string",
    "estado": "string" // Mensaje de estado legible.
  }
  ```
- **`resultado.pr_generada`**: Publicado cuando el agente ha generado una Pull Request.
  ```json
  {
    "pullRequestUrl": "string"
  }
  ```
- **`resultado.integracion_finalizada`**: Publicado por el `sandbox-service` al finalizar las pruebas.
  ```json
  {
    "exito": "boolean",
    "log": "string" // Log de las pruebas ejecutadas.
  }
  ```
---

## 3. Contratos de API Externa (`gateway-service`)

El `gateway-service` expondrá una API para la comunicación con el cliente (frontend). Se priorizará el uso de WebSockets para una comunicación bidireccional en tiempo real.

### 3.1 Comunicación WebSocket

- **Mensajes del Cliente al Servidor (Salientes):**
  - **Crear una nueva tarea:**
    ```json
    {
      "tipo": "CREAR_TAREA",
      "payload": {
        "prompt": "string",
        "repositorioOrigen": "string"
      }
    }
    ```
  - **Aprobar un plan:**
    ```json
    {
      "tipo": "APROBAR_PLAN",
      "payload": {
        "taskId": "string",
        "planId": "string"
      }
    }
    ```

- **Mensajes del Servidor al Cliente (Entrantes):**
  - **Actualización de progreso o estado:**
    ```json
    {
      "tipo": "ACTUALIZACION_PROGRESO",
      "payload": {
        "taskId": "string",
        "mensaje": "string", // Ej: "Plan generado, esperando aprobación."
        "datosAdicionales": {} // Opcional, para enviar datos como el plan.
      }
    }
    ```
  - **Tarea completada:**
    ```json
    {
      "tipo": "TAREA_FINALIZADA",
      "payload": {
        "taskId": "string",
        "estado": "string", // "COMPLETADA" o "FALLIDA"
        "resultado": {} // Ej: URL de la PR o mensaje de error.
      }
    }
    ```
