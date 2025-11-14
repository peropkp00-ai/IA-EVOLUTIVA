# Tareas de Verificación Pendientes

Este documento describe los pasos necesarios para probar y validar las implementaciones de los **Hitos 2, 3, 4 y 5**.

Una vez que el workflow de CI/CD construya las imágenes de Docker, se deben seguir los siguientes casos de prueba.

---

### Caso de Prueba 1: Hito 2 - Ciclo de Ejecución

**Objetivo:** Verificar que un `prompt` para una habilidad existente (`sumar`) se procesa correctamente.

**Pasos:**
1.  **Levantar el Entorno:** Ejecutar `docker-compose up --build`.
2.  **Enviar Tarea:** Usar un cliente de WebSocket para enviar el `prompt`: `"cuánto es 15 + 27"`.
3.  **Verificar Logs:** En el `orchestrator`, verificar la secuencia de estados hasta `COMPLETADA` con el resultado `42`.

---

### Caso de Prueba 2: Hitos 3, 4 y 5 - Flujo de Desarrollo Completo

**Objetivo:** Verificar el flujo completo desde la detección de una brecha hasta la generación de una PR simulada.

**Pasos:**

1.  **Detección y Planificación (Hitos 3 y 4):**
    *   **Enviar Tarea:** Usar el cliente de WebSocket para enviar el `prompt`: `"multiplica 5 por 3"`.
    *   **Verificar Logs (Orchestrator):** La tarea debe llegar al estado `ESPERANDO_APROBACION_PLAN_DESARROLLO` y se debe publicar el evento `resultado.plan_desarrollo_generado`. Anotar el `taskId` de los logs.

2.  **Aprobación y Desarrollo (Hito 5):**
    *   **Simular Aprobación:** Inyectar un evento `tarea.aprobar_plan_desarrollo` en la cola `topico.tareas` de RabbitMQ, usando el `taskId` anterior.
    *   **Verificar Logs (Orchestrator):** El estado debe cambiar a `DESARROLLANDO_HABILIDAD` y se debe publicar el evento `tarea.generar_plan`.
    *   **Verificar Logs (Herrero Adapter):** El servicio debe recibir `tarea.generar_plan`.
    *   **Esperar 10 segundos.**
    *   **Verificar Logs (Orchestrator):** El estado de la tarea debe cambiar a `PROBANDO_INTEGRACION` tras recibir `resultado.pr_generada`.

---

### Caso de Prueba 3: Manejo de Error (Prompt No Reconocido)

**Objetivo:** Asegurar que el sistema falla de forma controlada con un prompt que no entiende.

**Pasos:**
1.  **Enviar Tarea:** Enviar el `prompt`: `"cuál es el clima de hoy"`.
2.  **Verificar Logs:** La tarea debe transicionar a `FALLIDA_LOGICA`.
