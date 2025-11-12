const amqplib = require('amqplib');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

// --- Configuración ---
const RABBITMQ_URL = 'amqp://event-bus';
const TAREAS_TOPIC = 'topico.tareas';
const RESULTADOS_TOPIC = 'topico.resultados'; // Asumimos que también escucharemos resultados
const DB_PATH = './orchestrator.db';

// --- Base de Datos ---
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error abriendo la base de datos:', err.message);
    } else {
        console.log('Conectado a la base de datos de estado.');
        // Crear la tabla si no existe
        db.run(`CREATE TABLE IF NOT EXISTS tasks (
            taskId TEXT PRIMARY KEY,
            currentState TEXT NOT NULL,
            payload TEXT,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
        )`);
    }
});

// --- Conexión a RabbitMQ ---
let channel = null;

async function connectToRabbitMQ() {
    try {
        const connection = await amqplib.connect(RABBITMQ_URL);
        channel = await connection.createChannel();

        // Asegurar que las colas existen
        await channel.assertQueue(TAREAS_TOPIC, { durable: true });
        await channel.assertQueue(RESULTADOS_TOPIC, { durable: true });

        console.log('Orchestrator Service conectado a RabbitMQ');

        // Empezar a consumir mensajes de ambas colas
        channel.consume(TAREAS_TOPIC, handleMessage, { noAck: true });
        channel.consume(RESULTADOS_TOPIC, handleMessage, { noAck: true });

    } catch (error) {
        console.error('Error conectando a RabbitMQ:', error.message);
        setTimeout(connectToRabbitMQ, 5000);
    }
}

// --- Máquina de Estados (Manejador de Mensajes) ---
async function handleMessage(msg) {
    if (msg === null) return;

    try {
        const event = JSON.parse(msg.content.toString());
        const { metadata, payload } = event;
        const { taskId } = metadata;
        const { nombreEvento } = payload;

        console.log(`[${taskId}] Evento recibido: ${nombreEvento}`);

        switch (nombreEvento) {
            case 'tarea.crear':
                await createTask(taskId, payload);
                await updateTaskState(taskId, 'PLANIFICANDO');
                publishEvent(TAREAS_TOPIC, 'tarea.generar_plan', metadata, { prompt: payload.prompt });
                break;

            case 'resultado.plan_generado':
                await updateTaskState(taskId, 'ESPERANDO_APROBACION_PLAN');
                // En una implementación real, notificaríamos al gateway. Aquí, simplemente esperamos.
                console.log(`[${taskId}] Plan generado. Esperando aprobación.`);
                break;

            // Aquí se añadirían los manejadores para el resto de eventos del flujo
            // ej. 'tarea.aprobar_plan', 'resultado.pr_generada', etc.
        }
    } catch (error) {
        console.error('Error procesando mensaje:', error.message);
    }
}

// --- Funciones Auxiliares ---
function createTask(taskId, payload) {
    return new Promise((resolve, reject) => {
        const now = new Date().toISOString();
        db.run(
            'INSERT INTO tasks (taskId, currentState, payload, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
            [taskId, 'NUEVA', JSON.stringify(payload), now, now],
            (err) => {
                if (err) return reject(err);
                console.log(`[${taskId}] Tarea creada en la base de datos.`);
                resolve();
            }
        );
    });
}

function updateTaskState(taskId, newState) {
    return new Promise((resolve, reject) => {
        const now = new Date().toISOString();
        db.run(
            'UPDATE tasks SET currentState = ?, updatedAt = ? WHERE taskId = ?',
            [newState, now, taskId],
            function (err) {
                if (err) return reject(err);
                if (this.changes === 0) return reject(new Error('La tarea no fue encontrada.'));
                console.log(`[${taskId}] Estado actualizado a: ${newState}`);
                resolve();
            }
        );
    });
}

function publishEvent(topic, nombreEvento, originalMetadata, payload) {
    const { taskId } = originalMetadata;
    const newTraceId = uuidv4();

    const event = {
        metadata: {
            taskId,
            traceId: newTraceId,
            timestamp: new Date().toISOString(),
            originator: 'orchestrator-service'
        },
        payload: {
            nombreEvento,
            ...payload
        }
    };

    channel.sendToQueue(topic, Buffer.from(JSON.stringify(event)));
    console.log(`[${taskId}] Evento publicado: ${nombreEvento}`);
}

// --- Iniciar Servicio ---
connectToRabbitMQ();
