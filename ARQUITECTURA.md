# Arquitectura del Sistema

Este documento define la arquitectura de microservicios para el sistema de IA Evolutiva, según lo establecido en la **Fase 0** del plan de desarrollo. El diseño se basa en una comunicación asíncrona y desacoplada a través de un `event-bus`, garantizando la modularidad y escalabilidad del sistema.

## Servicios Centrales

A continuación, se describen los componentes centrales de la arquitectura y sus responsabilidades únicas.

### 1. `event-bus` (Sistema Nervioso)
- **Responsabilidad Única:** Gestionar toda la comunicación entre los servicios. Actúa como un *broker* de mensajes (ej. RabbitMQ, NATS), asegurando que los servicios no tengan conocimiento directo entre sí. Es el único punto de contacto y la única fuente de verdad para el flujo de eventos.

### 2. `gateway-service` (Punto de Entrada)
- **Responsabilidad Única:** Servir como la única interfaz expuesta al exterior (ej., una interfaz de usuario). Sus tareas son:
    - Gestionar la API (HTTP/WebSocket).
    - Autenticar y autorizar a los usuarios.
    - Traducir las acciones del usuario en eventos comprensibles para el sistema y publicarlos en el `event-bus`.

### 3. `orchestrator-service` (Cerebro / Gerente de Proyecto)
- **Responsabilidad Única:** Ser una **máquina de estados finitos**. Su función es gestionar el ciclo de vida completo de una tarea, desde su creación (`NUEVA`) hasta su finalización (`COMPLETADA` o `FALLIDA`). No ejecuta trabajo real; su única misión es escuchar eventos de resultado y publicar nuevos eventos de tarea para delegar el trabajo al servicio correspondiente.

### 4. `herrero-adapter-service` (Adaptador de Agente)
- **Responsabilidad Única:** Actuar como un **traductor** entre el lenguaje genérico del `orchestrator-service` y el lenguaje específico de cualquier agente de codificación externo. Convierte eventos como `tarea.generar_plan` en las llamadas de API concretas que el "herrero" (la IA de codificación) entienda. Esto permite intercambiar o actualizar el agente de IA sin afectar al resto del sistema.

### 5. `sandbox-service` (Validador de Integración)
- **Responsabilidad Única:** Proporcionar un **entorno de ejecución aislado y seguro** para verificar el código generado. Sus tareas son:
    - Recibir una referencia al código (ej. una URL de Pull Request).
    - Descargar, fusionar y ejecutar un conjunto predefinido de pruebas de integración y regresión.
    - Publicar un evento con el resultado (`exito: true/false`) y los logs de las pruebas.

### 6. `logging-service` (Observador Central)
- **Responsabilidad Única:** Servir como un **endpoint centralizado para la recolección de logs**. Todos los demás servicios envían sus logs estructurados (en formato JSON) a este servicio, permitiendo un rastreo (`tracing`) y depuración centralizados a lo largo de todo el flujo de una tarea.
