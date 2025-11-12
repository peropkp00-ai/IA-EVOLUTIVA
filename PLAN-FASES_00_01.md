Aquí tienes un plan de acción detallado y estructurado, dividido en dos fases iniciales (Fase 0 y Fase 1), para la creación de tu programa desde cero. Este plan está diseñado para construir una base robusta, desacoplada y escalable, abstrayendo las implementaciones específicas (como el agente de codificación) para permitir la "autosuficiencia" futura.

---

## 🏗️ FASE 0: EL PLANO ARQUITECTÓNICO Y LA DEFINICIÓN DE CONTRATOS

**Objetivo:** Definir *qué* vamos a construir, *cómo* se comunicarán las piezas y *qué* reglas seguirán. Esta fase es 100% de diseño y documentación. No se escribe lógica de negocio.

### 1.0 Definición del Dominio y la Arquitectura de Servicios

Se establece la arquitectura de microservicios, donde cada componente tiene una única responsabilidad.

* **1.1 Identificación de Servicios Centrales:**
    * **1.1.1 `event-bus` (Sistema Nervioso):** Un *broker* de mensajes (ej. RabbitMQ, NATS) que gestionará toda la comunicación. Es el único punto de contacto entre servicios.
    * **1.1.2 `gateway-service` (Punto de Entrada):** El único servicio expuesto a la interfaz de usuario. Gestiona la API (HTTP/WebSocket), la autenticación de usuarios y la traducción de acciones de usuario a eventos del bus.
    * **1.1.3 `orchestrator-service` (Cerebro / Gerente de Proyecto):** El núcleo del sistema. Su única responsabilidad es ser una **máquina de estados**. Gestiona el ciclo de vida completo de una tarea desde "nueva" hasta "completada" o "fallida". No ejecuta trabajo; solo delega.
    * **1.1.4 `herrero-adapter-service` (Adaptador de Agente):** Un servicio "traductor". Su única responsabilidad es convertir eventos *genéricos* del `orchestrator` (ej. `generar_plan`) en llamadas de API *específicas* al agente de codificación externo.
    * **1.1.5 `sandbox-service` (Validador de Integración):** Un entorno de ejecución aislado. Su única responsabilidad es recibir una referencia de código (ej. una URL de Pull Request), descargarla, fusionarla y ejecutar un conjunto de pruebas de integración y regresión predefinidas.
    * **1.1.6 `logging-service` (Observador):** Un *endpoint* centralizado que recibe *logs* estructurados de todos los demás servicios para permitir el rastreo y la depuración.

### 2.0 Definición del Protocolo de Comunicación (Contratos)

Este es el pilar de la "base sólida". Se define la "API" interna del sistema.

* **2.1 Nomenclatura del Bus de Eventos:**
    * Se definen los nombres exactos de los "temas" o "colas" (ej. `topico.tareas`, `topico.resultados`, `topico.logs`).

* **2.2 Esquemas de Mensajes (El Contrato JSON):**
    * Se crea un documento (o *Schema Registry*) que define la estructura JSON exacta para cada evento.
    * **2.2.1 Estructura de Metadatos (Obligatoria):** Cada evento *debe* contener un bloque de metadatos para rastreo:
        * `taskId`: Identificador único de la tarea principal.
        * `traceId`: Identificador único para rastrear este evento específico a través de todos los servicios.
        * `timestamp`: Marca de tiempo de la creación del evento.
        * `originator`: El nombre del servicio que emitió el evento.
    * **2.2.2 Eventos de Tareas (Ejemplos de definición):**
        * `tarea.crear`: *Payload* contiene el *prompt* inicial, el repositorio de origen y las reglas (ej. `requiere_aprobacion_plan`).
        * `tarea.generar_plan`: *Payload* contiene el *prompt* y el `taskId` para iniciar una sesión en el agente.
        * `tarea.aprobar_plan`: *Payload* contiene el `planId` a aprobar.
        * `tarea.consultar_estado`: *Payload* contiene el `sessionId` del agente a consultar.
        * `tarea.enviar_feedback`: *Payload* contiene el `sessionId` y el *prompt* de corrección.
        * `tarea.probar_integracion`: *Payload* contiene la URL de la Pull Request a probar.
    * **2.2.3 Eventos de Resultados (Ejemplos de definición):**
        * `resultado.plan_generado`: *Payload* contiene el plan JSON y el `planId`.
        * `resultado.estado_actualizado`: *Payload* contiene el texto de estado del agente.
        * `resultado.pr_generada`: *Payload* contiene la URL de la Pull Request.
        * `resultado.integracion_finalizada`: *Payload* contiene `exito: true/false` y el *log* de pruebas.

* **2.3 Contratos de API Externa (Gateway):**
    * Se define la API REST/WebSocket que el `gateway-service` expondrá al `frontend`.
    * *Ejemplo de WebSocket:* Mensajes de `tipo: "CREAR_TAREA"` (saliente), `tipo: "ACTUALIZACION_PROGRESO"` (entrante).

### 3.0 Definición de la Lógica de Estado y Monitoreo

Se diseña la inteligencia del `orchestrator-service` en papel.

* **3.1 Diagrama de Máquina de Estados Finitos:**
    * Se crea un diagrama de flujo que define todos los estados posibles de una tarea y las transiciones entre ellos.
    * *Estados:* `NUEVA`, `PLANIFICANDO`, `ESPERANDO_APROBACION_PLAN`, `EJECUTANDO_CODIGO`, `MONITOREANDO_EJECUCION`, `PROBANDO_INTEGRACION`, `ESPERANDO_FEEDBACK_INTERNO`, `COMPLETADA`, `FALLIDA_LOGICA`, `FALLIDA_INFRAESTRUCTURA`.
    * *Transiciones:* Se define qué evento (ej. `resultado.plan_generado`) mueve una tarea de un estado a otro (ej. de `PLANIFICANDO` a `ESPERANDO_APROBACION_PLAN`).

* **3.2 Estrategia de Monitoreo de Tareas (Watchdog):**
    * Se define cómo el Orquestador maneja tareas de larga duración y fallos.
    * **3.2.1 Timeout de Silencio (Liveness):** El Orquestador implementará un temporizador de "silencio". Si un servicio (ej. `herrero-adapter`) no envía *ningún* tipo de mensaje (ni progreso, ni resultado) en un tiempo X (ej. 5 minutos), se considera *muerto* y la tarea se marca como `FALLIDA_INFRAESTRUCTURA`.
    * **3.2.2 Monitoreo Activo (Polling):** El Orquestador implementará un temporizador de "consulta". Cada X minutos (ej. 2 minutos), publicará automáticamente un evento `tarea.consultar_estado` para la tarea activa.
    * **3.2.3 Heartbeat (Latido):** Los servicios de larga duración (como el `herrero-adapter`) *deben* responder a la `tarea.consultar_estado` con un `resultado.estado_actualizado`. Esta respuesta *resetea* el "Timeout de Silencio", permitiendo que la tarea continúe indefinidamente mientras siga respondiendo.

### 4.0 Configuración del Entorno de Desarrollo Base

Se prepara el "taller" para la Fase 1.

* **4.1 Creación del Monorepo:** Se configura un repositorio Git único que contendrá las carpetas de todos los servicios.
* **4.2 Creación del `docker-compose.yml` Base:** Se crea el archivo de composición que define todos los servicios de infraestructura (el `event-bus`, el `logging-service`, la BBDD de estado del Orquestador).
* **4.3 Creación del Andamiaje (Scaffolding):** Se crean las carpetas de cada servicio (`gateway`, `orchestrator`, `herrero-adapter`, `sandbox`) con sus archivos `package.json` (o equivalentes) y el código "hola mundo" para conectarse al `event-bus`.

---

## 🚀 FASE 1: CONSTRUCCIÓN Y PRUEBA DEL NÚCLEO (FLUJO SIMULADO)

**Objetivo:** Construir el "chasis" de la arquitectura y probar el flujo de eventos de principio a fin utilizando **simuladores (Mocks)**. Esto valida que la arquitectura (Fase 0) funciona antes de implementar la lógica de negocio real.

### 1.0 Construcción de los Servicios Centrales (Reales)

Se construye la lógica real de los servicios que no ejecutan trabajo externo.

* **1.1 Desarrollo del `gateway-service`:**
    * Implementar la API (WebSocket/HTTP) definida en el Contrato (Fase 0, 2.3).
    * Implementar la lógica para publicar eventos (ej. `tarea.crear`) en el `event-bus`.
    * Implementar la lógica para suscribirse a eventos de progreso (`resultado.*`) y reenviarlos al cliente correcto.

* **1.2 Desarrollo del `orchestrator-service`:**
    * Implementar la conexión a su BBDD de estado.
    * Implementar la **Máquina de Estados Finitos** completa (Fase 0, 3.1). El servicio debe reaccionar a todos los eventos definidos en los contratos.
    * Implementar la lógica del **Watchdog** (Timeout de Silencio y Monitoreo Activo) (Fase 0, 3.2).
    * Implementar la conexión a su **LLM interno** para la generación de *feedback*.

### 2.0 Construcción de los Servicios Periféricos (Simulados)

Se construyen "actores" falsos que *imitan* perfectamente el comportamiento de los servicios reales, adhiriéndose a los contratos de la Fase 0.

* **2.1 Desarrollo del `mock-herrero-adapter-service`:**
    * Debe conectarse al `event-bus` y escuchar sus eventos (`tarea.generar_plan`, `tarea.consultar_estado`, etc.).
    * **Simulación de `tarea.generar_plan`:** Al recibir este evento, espera 5 segundos y publica un `resultado.plan_generado` (con un JSON de plan falso).
    * **Simulación de `tarea.aprobar_plan`:** Al recibir esto, espera 15 segundos (simulando trabajo) y publica un `resultado.pr_generada` (con una URL falsa).
    * **Simulación de `tarea.consultar_estado`:** Al recibir esto, publica inmediatamente un `resultado.estado_actualizado` (con un mensaje falso como "Estoy trabajando en el plan").
    * **Simulación de `tarea.enviar_feedback`:** Al recibir esto, espera 10 segundos y publica un nuevo `resultado.pr_generada` (simulando una corrección).

* **2.2 Desarrollo del `mock-sandbox-service`:**
    * Debe conectarse al `event-bus` y escuchar `tarea.probar_integracion`.
    * **Simulación:** Al recibir el evento, espera 10 segundos (simulando pruebas) y publica un `resultado.integracion_finalizada` (con `exito: true` y un log falso).

### 3.0 Prueba de Integración del Flujo Completo

Se valida que la arquitectura funciona de extremo a extremo.

* **3.1 Prueba del "Happy Path" (Flujo Exitoso):**
    * **Acción:** Levantar todos los servicios (reales y mocks) con `docker-compose up`.
    * **Prueba:**
        1.  Usar la interfaz (o una herramienta de API) para enviar una `tarea.crear` al `gateway`.
        2.  **Verificar (en el `logging-service`):**
        3.  Que el `orchestrator` la recibe y publica `tarea.generar_plan`.
        4.  Que el `mock-herrero` la recibe y publica `resultado.plan_generado`.
        5.  Que el `orchestrator` la recibe y entra en estado `ESPERANDO_APROBACION_PLAN`.
        6.  Enviar manualmente `tarea.aprobar_plan`.
        7.  **Verificar:**
        8.  Que el `mock-herrero` la recibe y publica `resultado.pr_generada`.
        9.  Que el `orchestrator` la recibe y publica `tarea.probar_integracion`.
        10. Que el `mock-sandbox` la recibe y publica `resultado.integracion_finalizada`.
        11. Que el `orchestrator` la recibe y marca la tarea como `COMPLETADA`.

* **3.2 Prueba del "Feedback Loop" (Flujo de Corrección):**
    * **Acción:** Modificar el `mock-sandbox-service` para que siempre devuelva `exito: false`.
    * **Prueba:** Repetir la prueba 3.1.
    * **Verificar:**
        1.  Que el `orchestrator` recibe `resultado.integracion_finalizada` (con `exito: false`).
        2.  Que el `orchestrator` (usando su LLM) genera y publica un `tarea.enviar_feedback`.
        3.  Que el `mock-herrero` lo recibe y el ciclo de "corrección" se reinicia.
