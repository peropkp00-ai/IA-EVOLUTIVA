const amqplib = require('amqplib');
const { v4: uuidv4 } = require('uuid');

// --- Configuración ---
const RABBITMQ_URL = 'amqp://event-bus';
const TAREAS_TOPIC = 'topico.tareas';
const RESULTADOS_TOPIC = 'topico.resultados';

// --- Conexión a RabbitMQ ---
let channel = null;

async function connectToRabbitMQ() {
    try {
        const connection = await amqplib.connect(RABBITMQ_URL);
        channel = await connection.createChannel();

        await channel.assertQueue(TAREAS_TOPIC, { durable: true });
        await channel.assertQueue(RESULTADOS_TOPIC, { durable: true });

        console.log('Mock Sandbox Service conectado a RabbitMQ');

        // Empezar a consumir mensajes de la cola de tareas
        channel.consume(TAREAS_TOPIC, handleMessage, { noAck: true });

    } catch (error) {
        console.error('Error conectando a RabbitMQ:', error.message);
        setTimeout(connectToRabbitMQ, 5000);
    }
}

// --- Lógica de Simulación ---
async function handleMessage(msg) {
    if (msg === null) return;

    try {
        const event = JSON.parse(msg.content.toString());
        const { metadata, payload } = event;
        const { taskId } = metadata;
        const { nombreEvento } = payload;

        if (nombreEvento === 'tarea.probar_integracion') {
            console.log(`[${taskId}] Recibido ${nombreEvento}. Simulando pruebas de integración...`);

            // Simular un retraso de 10 segundos
            setTimeout(() => {
                const logFalso = "Build iniciado...\nPruebas unitarias pasaron (15/15).\nPruebas de integración pasaron (5/5).\nBuild exitoso.";

                // Publicar el resultado falso (éxito por defecto para el "Happy Path")
                publishEvent(RESULTADOS_TOPIC, 'resultado.integracion_finalizada', metadata, { exito: true, log: logFalso });
                console.log(`[${taskId}] Pruebas simuladas finalizadas y resultado publicado.`);
            }, 10000);
        }

    } catch (error) {
        console.error('Error procesando mensaje en Mock Sandbox:', error.message);
    }
}

// --- Función de Publicación ---
function publishEvent(topic, nombreEvento, originalMetadata, payload) {
    const { taskId } = originalMetadata;
    const newTraceId = uuidv4();

    const event = {
        metadata: {
            taskId,
            traceId: newTraceId,
            timestamp: new Date().toISOString(),
            originator: 'mock-sandbox-service'
        },
        payload: {
            nombreEvento,
            ...payload
        }
    };

    channel.sendToQueue(topic, Buffer.from(JSON.stringify(event)));
    console.log(`[${taskId}] Evento simulado publicado: ${nombreEvento}`);
}

// --- Iniciar Servicio ---
connectToRabbitMQ();
