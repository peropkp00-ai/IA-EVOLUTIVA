# Lógica de Estado y Monitoreo

Este documento define la lógica interna del `orchestrator-service`, según lo establecido en la **Fase 0** del plan de desarrollo. Contiene la Máquina de Estados Finitos que gobierna el ciclo de vida de una tarea y la estrategia de monitoreo para manejar tareas de larga duración y fallos.

---

## 1. Máquina de Estados Finitos (FSM)

El `orchestrator-service` opera como una Máquina de Estados Finitos. Cada tarea en el sistema existe en uno, y solo uno, de los siguientes estados. Las transiciones entre estados son provocadas por la recepción de eventos específicos del `event-bus`.

### 1.1 Estados Posibles de una Tarea

- **`NUEVA`**: El estado inicial de una tarea inmediatamente después de ser creada por el `gateway-service`.
- **`PLANIFICANDO`**: El orquestador ha delegado la creación de un plan al `herrero-adapter-service` y está esperando el resultado.
- **`ESPERANDO_APROBACION_PLAN`**: El plan ha sido generado y se requiere la aprobación explícita del usuario para continuar.
- **`EJECUTANDO_CODIGO`**: El plan ha sido aprobado y el orquestador ha delegado la generación del código/PR al `herrero-adapter-service`.
- **`MONITOREANDO_EJECUCION`**: Un sub-estado de `EJECUTANDO_CODIGO` donde el orquestador está vigilando activamente una tarea de larga duración, esperando un resultado o un heartbeat.
- **`PROBANDO_INTEGRACION`**: Se ha generado una Pull Request y el orquestador ha delegado su prueba al `sandbox-service`.
- **`ESPERANDO_FEEDBACK_INTERNO`**: Las pruebas de integración fallaron. El orquestador está utilizando su LLM interno para analizar el fallo y generar un feedback correctivo.
- **`COMPLETADA`**: La tarea ha finalizado con éxito (ej. las pruebas de integración pasaron). Es un estado terminal.
- **`FALLIDA_LOGICA`**: La tarea ha fallado debido a un error de lógica que no pudo ser resuelto (ej. un bucle de feedback infinito). Es un estado terminal.
- **`FALLIDA_INFRAESTRUCTURA`**: La tarea ha fallado porque un servicio no respondió en el tiempo esperado. Es un estado terminal.

### 1.2 Transiciones de Estado

A continuación se muestra el flujo principal de transiciones:

| Estado Actual                 | Evento Recibido                             | Nuevo Estado                  | Acción a Realizar (Publicar Evento)            |
|-------------------------------|---------------------------------------------|-------------------------------|------------------------------------------------|
| `NUEVA`                       | `tarea.crear` (del Gateway)                 | `PLANIFICANDO`                | `tarea.generar_plan`                           |
| `PLANIFICANDO`                | `resultado.plan_generado`                   | `ESPERANDO_APROBACION_PLAN`   | (Ninguna, esperar al usuario)                  |
| `ESPERANDO_APROBACION_PLAN`   | `tarea.aprobar_plan` (del Gateway)          | `EJECUTANDO_CODIGO`           | `tarea.aprobar_plan` (para el Herrero)         |
| `EJECUTANDO_CODIGO`           | `resultado.pr_generada`                     | `PROBANDO_INTEGRACION`        | `tarea.probar_integracion`                     |
| `PROBANDO_INTEGRACION`        | `resultado.integracion_finalizada` {exito: true} | `COMPLETADA`                  | (Ninguna, notificar al Gateway)                |
| `PROBANDO_INTEGRACION`        | `resultado.integracion_finalizada` {exito: false}| `ESPERANDO_FEEDBACK_INTERNO`  | (Ninguna, iniciar LLM interno)                 |
| `ESPERANDO_FEEDBACK_INTERNO`  | (Feedback de LLM generado)                  | `EJECUTANDO_CODIGO`           | `tarea.enviar_feedback`                        |

---

## 2. Estrategia de Monitoreo de Tareas (Watchdog)

Para garantizar que ninguna tarea quede "atascada" indefinidamente, el Orquestador implementará un mecanismo de vigilancia (Watchdog) con las siguientes estrategias:

### 2.1 Timeout de Silencio (Liveness)

- **Concepto:** Cuando el Orquestador delega una tarea a otro servicio (ej. al pasar a `PLANIFICANDO`), inicia un temporizador de "silencio" (ej. 5 minutos).
- **Condición de Fallo:** Si no se recibe **ningún** mensaje relacionado con esa tarea (ni un resultado, ni un heartbeat) antes de que el temporizador expire, la tarea se considerará fallida.
- **Acción:** El estado de la tarea se cambiará a `FALLIDA_INFRAESTRUCTURA` y se notificará el error.

### 2.2 Monitoreo Activo (Polling) y Heartbeat (Latido)

- **Concepto:** Para estados que se esperan sean de larga duración (como `EJECUTANDO_CODIGO`), el Orquestador no solo esperará pasivamente.
- **Monitoreo Activo:** Periódicamente (ej. cada 2 minutos), el Orquestador publicará un evento `tarea.consultar_estado` para la tarea activa.
- **Heartbeat:** Se espera que el servicio que está ejecutando la tarea (ej. `herrero-adapter-service`) responda **inmediatamente** a este evento con un `resultado.estado_actualizado`.
- **Efecto:** La recepción de este "latido" (heartbeat) **resetea el temporizador del "Timeout de Silencio"**, permitiendo que la tarea continúe ejecutándose por otro período de 5 minutos. Si el servicio no responde a la consulta, el Timeout de Silencio eventualmente se activará.
