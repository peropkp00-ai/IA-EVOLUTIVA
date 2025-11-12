***********
Checklist de Desarrollo Progresivo: IA Evolutiva (Plan Completo)

Este documento detalla la hoja de ruta integral para el desarrollo del sistema, comenzando desde el diseño de la arquitectura hasta la implementación de la Visión de "IA Evolutiva".

Hito 0: Diseño de Arquitectura y Contratos (Fase 00)

[x] Resultado: El plano arquitectónico (Fase 00) está completo y documentado.

Capacidades a Validar:

[x] 1.1 Identificación de Servicios: Se definen las responsabilidades únicas de los servicios centrales (event-bus, gateway-service, orchestrator-service, herrero-adapter-service, sandbox-service, logging-service).

[x] 2.0 Definición de Contratos: Se crea el documento (o Schema Registry) que define la estructura JSON exacta para cada evento del bus (ej. tarea.crear, resultado.plan_generado, tarea.probar_integracion, etc.).

[x] 3.0 Definición de la Máquina de Estados: Se crea el diagrama de flujo que define todos los estados posibles de una tarea en el orchestrator-service.

[x] 3.1 Definición de Monitoreo: Se define la estrategia de Watchdog (Timeout de Silencio y Monitoreo Activo por Consulta).

[x] 4.0 Configuración del Entorno: Se crea el Monorepo, el docker-compose.yml base y el andamiaje (scaffolding) de carpetas para cada servicio.

Estado al Completar: El "plano" del sistema está terminado. Todos los contratos de comunicación están definidos.

Hito 1: Construcción del Chasis (Flujo Simulado - Fase 01)

[x] Resultado: El "chasis" de la arquitectura está 100% operativo y probado de extremo a extremo con servicios periféricos simulados (mocks).

Capacidades a Validar:

[x] 1.1 Construcción del gateway-service real: La interfaz de usuario puede enviar tareas reales al event-bus.

[x] 1.2 Construcción del orchestrator-service real: El cerebro implementa la Máquina de Estados (del Hito 0) y su BBDD. Reacciona a eventos y publica nuevos eventos.

[x] 2.1 Construcción del mock-herrero-adapter-service: Un simulador que escucha eventos tarea.generar_plan y responde con resultado.plan_generado falsos, adhiriéndose al Contrato (Hito 0).

[x] 2.2 Construcción del mock-sandbox-service: Un simulador que escucha tarea.probar_integracion y responde con resultado.integracion_finalizada falsos.

[x] 3.0 Prueba de Integración Simulada: Se valida el "Happy Path" y el "Feedback Loop" (simulando un exito: false) usando solo los mocks.

Estado al Completar: El sistema nervioso (event-bus) y el cerebro (orchestrator) están validados. El sistema funciona en un mundo predecible.

Hito 2: Implementación del "Ciclo de Ejecución"

[ ] Resultado: El Agente Maestro (orchestrator-service) puede ejecutar tareas usando un conjunto predefinido de habilidades.

Capacidades a Validar:

[ ] Se crea un skill-registry (Base de Datos) conectado al Agente Maestro.

[ ] Se registra manualmente una habilidad simple (ej. sumar(a, b)) con su código de ejecución local (dentro del Orquestador o un nuevo microservicio de "habilidades").

[ ] El Agente Maestro recibe un objetivo (ej. "cuánto es 2+2").

[ ] El Agente Maestro realiza el "Análisis del Requerimiento" (entiende que debe sumar).

[ ] El Agente Maestro realiza la "Composición de Habilidades" (encuentra la habilidad sumar en su registro).

[ ] El Agente Maestro ejecuta la habilidad y devuelve el resultado ("4").

Estado al Completar: El sistema tiene su "ciclo de ejecución" interno y puede resolver tareas simples por sí mismo.

Hito 3: Detección de Brechas de Capacidad

[ ] Resultado: El Agente Maestro puede reconocer cuándo le falta una habilidad (Hito 2) necesaria para cumplir un objetivo.

Capacidades a Validar:

[ ] El Agente Maestro recibe un objetivo para el cual no tiene habilidad (ej. "multiplica 5 por 3").

[ ] El Agente Maestro analiza el objetivo y consulta su skill-registry.

[ ] El Agente Maestro identifica que la habilidad "multiplicar" no existe.

[ ] El Agente Maestro informa al usuario (vía gateway): "He detectado una Brecha de Capacidad. Me falta la habilidad 'multiplicar'."

Estado al Completar: El sistema implementa la "Detección de Brechas de Capacidad".

Hito 4: "Meta-Habilidad: Planificación del Desarrollo"

[ ] Resultado: Cuando se detecta una brecha (Hito 3), el objetivo del Agente Maestro cambia de "ejecutar" a "construir la herramienta".

Capacidades a Validar:

[ ] Al detectar la brecha (Hito 3), el Agente Maestro (usando su LLM interno) genera un "plan de desarrollo de software" para la habilidad faltante (ej. "multiplicar").

[ ] El plan detalla los pasos: 1. Definir la especificación. 2. Escribir el código. 3. Crear pruebas unitarias. 4. Validar las pruebas. 5. Registrar la nueva habilidad.

[ ] El Agente Maestro presenta este plan al usuario para su aprobación.

Estado al Completar: El sistema implementa la "Planificación del Desarrollo".

Hito 5: "Meta-Habilidad: Desarrollo de Código" (Integración del Herrero)

[ ] Resultado: El mock-herrero-adapter (del Hito 1) es reemplazado por el herrero-adapter-service real, integrando al agente externo (Jules).

Capacidades a Validar:

[ ] El usuario aprueba el plan (del Hito 4).

[ ] El Agente Maestro actúa como "Gerente de Proyecto" y publica el evento tarea.generar_plan con el prompt técnico (ej. "Escribe una función 'multiplicar(a, b)'...").

[ ] El herrero-adapter-service real recibe el evento, llama a la API de Jules (POST /sessions) e inicia el monitoreo (GET /activities).

[ ] El Agente Maestro recibe los artefactos de código (gitPatch) devueltos por el Herrero (vía el herrero-adapter).

Estado al Completar: El Agente Maestro puede orquestar al agente externo para escribir código.

Hito 6: El "Ciclo de Auto-Mejora" (Validación y Registro)

[ ] Resultado: El mock-sandbox-service (del Hito 1) es reemplazado por el sandbox-service real, completando el "Ciclo de Auto-Mejora".

Capacidades a Validar (El Ciclo Completo):

[ ] El Agente Maestro (Hito 5) envía los artefactos de código (gitPatch) al sandbox-service real (publicando tarea.probar_integracion).

[ ] El sandbox-service real aplica el parche y ejecuta las pruebas definidas en el plan (Hito 4).

[ ] El Sandbox reporta exito: true (vía resultado.integracion_finalizada).

[ ] El Agente Maestro (al ver el éxito) añade la habilidad 'multiplicar' a su skill-registry (Hito 2).

[ ] El Agente Maestro re-evalúa el requerimiento original ("multiplica 5 por 3").

[ ] El Agente Maestro (Hito 2) ahora encuentra la habilidad en su registro, la ejecuta y devuelve el resultado ("15").

Estado al Completar: El sistema alcanza la "IA Evolutiva" y el "Ciclo de Auto-Mejora" (detectar -> planificar desarrollo -> construir -> ejecutar).

Hito 7: "Meta-Habilidad: Investigación Profunda" (Opcional)

[ ] Resultado: El Agente Maestro puede aprender sobre conceptos que no conoce para construir habilidades más complejas.

Capacidades a Validar:

[ ] Se implementa un research-service (nuevo microservicio adaptador de búsqueda web).

[ ] El usuario pide una habilidad compleja (ej. "crea una habilidad para calcular la distancia de Levenshtein").

[ ] El Agente Maestro detecta la brecha (Hito 3).

[ ] El Agente Maestro (Hito 4) crea un plan que incluye un paso de "Investigación".

[ ] El Agente Maestro ejecuta ese paso llamando al research-service (vía el event-bus).

[ ] El Agente Maestro utiliza la información obtenida para generar el prompt de desarrollo de código (Hito 5).

Estado al Completar: El sistema puede construir herramientas sobre temas que no conocía, logrando la visión completa de autosuficiencia.
**************