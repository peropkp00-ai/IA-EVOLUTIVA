const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const amqplib = require('amqplib');
const { v4: uuidv4 } = require('uuid');

// --- Configuración ---
const PORT = 3000;
const RABBITMQ_URL = 'amqp://event-bus';
const TAREAS_TOPIC = 'topico.tareas';

// --- Inicialización del Servidor ---
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let channel = null;

// --- Conexión a RabbitMQ ---
async function connectToRabbitMQ() {
    try {
        const connection = await amqplib.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue(TAREAS_TOPIC, { durable: true });
        console.log('Gateway Service conectado a RabbitMQ');
    } catch (error) {
        console.error('Error conectando a RabbitMQ:', error.message);
        // Reintentar la conexión después de un tiempo
        setTimeout(connectToRabbitMQ, 5000);
    }
}

// --- Lógica del WebSocket ---
wss.on('connection', (ws) => {
    console.log('Cliente conectado al Gateway Service');

    ws.on('message', (message) => {
        try {
            const parsedMessage = JSON.parse(message);
            console.log('Mensaje recibido:', parsedMessage);

            // Validar que el canal de RabbitMQ esté listo
            if (!channel) {
                console.error('El canal de RabbitMQ no está disponible. No se puede procesar el mensaje.');
                ws.send(JSON.stringify({ tipo: 'ERROR', payload: { mensaje: 'Servicio no disponible, intente de nuevo más tarde.' } }));
                return;
            }

            // Procesar el mensaje según su tipo
            switch (parsedMessage.tipo) {
                case 'CREAR_TAREA':
                    handleCrearTarea(parsedMessage.payload);
                    break;
                // Aquí se añadirían más casos como APROBAR_PLAN, etc.
                default:
                    console.warn('Tipo de mensaje no reconocido:', parsedMessage.tipo);
            }
        } catch (error) {
            console.error('Error procesando el mensaje:', error.message);
        }
    });

    ws.on('close', () => {
        console.log('Cliente desconectado');
    });
});


// --- Manejadores de Eventos ---
function handleCrearTarea(payload) {
    const taskId = uuidv4();
    const traceId = uuidv4();

    // Crear el evento según el contrato definido
    const evento = {
        metadata: {
            taskId,
            traceId,
            timestamp: new Date().toISOString(),
            originator: 'gateway-service'
        },
        payload: {
            nombreEvento: 'tarea.crear', // Campo para enrutar en el orquestador
            ...payload
        }
    };

    // Publicar el evento en el event-bus
    channel.sendToQueue(TAREAS_TOPIC, Buffer.from(JSON.stringify(evento)));
    console.log(`[${taskId}] Tarea creada y enviada al event-bus`);
}


// --- Iniciar el servidor ---
server.listen(PORT, async () => {
    console.log(`Gateway Service escuchando en el puerto ${PORT}`);
    await connectToRabbitMQ();
});
