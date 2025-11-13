const amqplib = require('amqplib');
const { v4: uuidv4 } = require('uuid');

// --- Configuración ---
const RABBITMQ_URL = 'amqp://event-bus';
const TAREAS_TOPIC = 'topico.tareas';
const RESULTADOS_TOPIC = 'topico.resultados';

let channel = null;

// --- Funciones de Publicación de Eventos ---
function publishEvent(topic, nombreEvento, originalMetadata, payload) {
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

    channel.sendToQueue(topic, Buffer.from(JSON.stringify(event)));
    console.log(`[${taskId}] Evento publicado: ${nombreEvento}`);
}

// --- Lógica del Servicio ---
async function handleMessage(msg) {
    if (msg === null) return;

    try {
        const event = JSON.parse(msg.content.toString());
        const { metadata, payload } = event;
        const { taskId } = metadata;
        const { nombreEvento } = payload;

        if (nombreEvento !== 'tarea.generar_plan') {
            return;
        }

        console.log(`[${taskId}] Evento 'tarea.generar_plan' recibido.`);
        console.log(`[${taskId}] Simulando interacción con la API del Herrero...`);

        setTimeout(() => {
            const fakePullRequestUrl = `https://github.com/example/repo/pull/${Math.floor(Math.random() * 1000)}`;

            console.log(`[${taskId}] Simulación completada. Publicando 'resultado.pr_generada'.`);

            publishEvent(RESULTADOS_TOPIC, 'resultado.pr_generada', metadata, {
                pullRequestUrl: fakePullRequestUrl
            });
        }, 10000); // 10 segundos de retraso

    } catch (error) {
        console.error('Error procesando mensaje:', error.message);
    }
}

// --- Conexión a RabbitMQ ---
async function connectToRabbitMQ() {
    try {
        const connection = await amqplib.connect(RABBITMQ_URL);
        channel = await connection.createChannel();

        await channel.assertQueue(TAREAS_TOPIC, { durable: true });
        await channel.assertQueue(RESULTADOS_TOPIC, { durable: true });

        console.log('Herrero Adapter Service conectado a RabbitMQ');

        channel.consume(TAREAS_TOPIC, handleMessage, { noAck: true });

    } catch (error) {
        console.error('Error conectando a RabbitMQ:', error.message);
        setTimeout(connectToRabbitMQ, 5000);
    }
}

// --- Iniciar Servicio ---
connectToRabbitMQ();
