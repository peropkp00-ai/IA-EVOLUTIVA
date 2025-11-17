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

        console.log('Mock Herrero Adapter conectado a RabbitMQ');

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

        // Solo reacciona a los eventos que le conciernen
        if (nombreEvento === 'tarea.generar_plan') {
            console.log(`[${taskId}] Recibido ${nombreEvento}. Simulando generación de plan...`);

            // Simular un retraso de 5 segundos
            setTimeout(() => {
                const planId = uuidv4();
                const planFalso = {
                    pasos: [
                        { "accion": "paso_1_falso", "descripcion": "Este es el primer paso simulado." },
                        { "accion": "paso_2_falso", "descripcion": "Este es el segundo paso simulado." }
                    ]
                };

                // Publicar el resultado falso
                publishEvent(RESULTADOS_TOPIC, 'resultado.plan_generado', metadata, { planId, plan: planFalso });
                console.log(`[${taskId}] Plan simulado generado y publicado.`);
            }, 5000);
        }

        // Aquí se añadirían más simulaciones, como para 'tarea.aprobar_plan'

    } catch (error) {
        console.error('Error procesando mensaje en Mock Herrero:', error.message);
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
            originator: 'mock-herrero-adapter-service'
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
