const amqplib = require('amqplib');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// --- Configuración ---
const RABBITMQ_URL = 'amqp://event-bus';
const TAREAS_TOPIC = 'topico.tareas';
const RESULTADOS_TOPIC = 'topico.resultados';
const JULES_SERVICE_URL = 'ws://jules-service:8080'; // Asumiendo puerto 8080

let rabbitChannel = null;

// --- Conexión a RabbitMQ ---
async function connectToRabbitMQ() {
    try {
        const connection = await amqplib.connect(RABBITMQ_URL);
        rabbitChannel = await connection.createChannel();
        await rabbitChannel.assertQueue(TAREAS_TOPIC, { durable: true });
        console.log('Herrero Adapter conectado a RabbitMQ');
        rabbitChannel.consume(TAREAS_TOPIC, handleRabbitMessage, { noAck: true });
    } catch (error) {
        console.error('Error conectando a RabbitMQ:', error.message);
        setTimeout(connectToRabbitMQ, 5000);
    }
}

// --- Manejador de Mensajes de RabbitMQ ---
async function handleRabbitMessage(msg) {
    if (msg === null) return;
    try {
        const event = JSON.parse(msg.content.toString());
        const { metadata, payload } = event;
        if (payload.nombreEvento === 'tarea.generar_plan') {
            console.log(`[${metadata.taskId}] tarea.generar_plan recibido. Conectando a Jules Service...`);
            initiateJulesSession(metadata, payload);
        }
    } catch (error) {
        console.error('Error procesando mensaje de RabbitMQ:', error.message);
    }
}

// --- Lógica de Interacción con Jules Service ---
function initiateJulesSession(originalMetadata, originalPayload) {
    const ws = new WebSocket(JULES_SERVICE_URL);

    ws.on('open', () => {
        console.log(`[${originalMetadata.taskId}] Conexión WebSocket con Jules Service establecida.`);
        const startCommand = {
            type: 'start',
            prompt: originalPayload.prompt,
            // Podríamos añadir más datos si fueran necesarios
        };
        ws.send(JSON.stringify(startCommand));
    });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log(`[${originalMetadata.taskId}] Mensaje recibido de Jules Service:`, data.type);

            if (data.type === 'status_update' && data.status === 'SESSION_COMPLETED') {
                const prOutput = data.outputs.find(o => o.type === 'pullRequest');
                if (prOutput) {
                    console.log(`[${originalMetadata.taskId}] Sesión completada. PR encontrada: ${prOutput.url}`);
                    publishToRabbit(RESULTADOS_TOPIC, 'resultado.pr_generada', originalMetadata, {
                        pullRequestUrl: prOutput.url
                    });
                } else {
                    console.error(`[${originalMetadata.taskId}] Sesión completada, pero no se encontró una Pull Request en los outputs.`);
                }
                ws.close();
            } else if (data.type === 'error') {
                console.error(`[${originalMetadata.taskId}] Error recibido de Jules Service:`, data.message);
            }
        } catch (error) {
            console.error(`[${originalMetadata.taskId}] Error procesando mensaje de Jules Service:`, error.message);
        }
    });

    ws.on('close', () => {
        console.log(`[${originalMetadata.taskId}] Conexión WebSocket con Jules Service cerrada.`);
    });

    ws.on('error', (error) => {
        console.error(`[${originalMetadata.taskId}] Error de WebSocket:`, error.message);
        // Podríamos publicar un evento de error de vuelta a RabbitMQ
    });
}

// --- Función para Publicar de Vuelta a RabbitMQ ---
function publishToRabbit(topic, nombreEvento, originalMetadata, payload) {
    if (!rabbitChannel) {
        console.error("No se puede publicar en RabbitMQ, el canal no está disponible.");
        return;
    }
    const { taskId } = originalMetadata;
    const newTraceId = uuidv4();
    const event = {
        metadata: {
            taskId,
            traceId: newTraceId,
            timestamp: new Date().toISOString(),
            originator: 'herrero-adapter-service'
        },
        payload: {
            nombreEvento,
            ...payload
        }
    };
    rabbitChannel.sendToQueue(topic, Buffer.from(JSON.stringify(event)));
    console.log(`[${taskId}] Evento '${nombreEvento}' publicado de vuelta al event-bus.`);
}

// --- Iniciar Servicio ---
connectToRabbitMQ();
