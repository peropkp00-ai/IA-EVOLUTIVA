const amqplib = require('amqplib');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// --- Registro de Habilidades ---
let skillRegistry = [];
try {
    const rawData = fs.readFileSync('./skill-registry.json', 'utf8');
    skillRegistry = JSON.parse(rawData);
    console.log('Registro de habilidades cargado exitosamente.');
} catch (error) {
    console.error('Error cargando el registro de habilidades:', error.message);
    process.exit(1); // Salir si no se pueden cargar las habilidades
}

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
                await updateTaskState(taskId, 'ANALIZANDO_PROMPT');

                try {
                    const analysisResult = await analizarPrompt(payload.prompt);

                    if (analysisResult.analysis === 'SKILL_FOUND') {
                        // Flujo del Hito 2: Habilidad encontrada, proceder a ejecutar.
                        await updateTaskState(taskId, 'EJECUTANDO_HABILIDAD');
                        const result = await executeSkill(analysisResult.skillId, analysisResult.params);

                        publishEvent(RESULTADOS_TOPIC, 'resultado.habilidad_ejecutada', metadata, {
                            resultado: result,
                            promptOriginal: payload.prompt
                        });

                    } else if (analysisResult.analysis === 'CAPACITY_GAP') {
                        // Flujo del Hito 3: Brecha de capacidad detectada.
                        await updateTaskState(taskId, 'BRECHA_CAPACIDAD_DETECTADA');
                        console.log(`[${taskId}] Brecha de capacidad detectada. Habilidad faltante: '${analysisResult.missingSkill}'`);
                        // En el futuro, aquí se iniciaría el plan de desarrollo.
                    }

                } catch (error) {
                    // El prompt no fue reconocido.
                    console.error(`[${taskId}] Error en el análisis del prompt:`, error.message);
                    await updateTaskState(taskId, 'FALLIDA_LOGICA');
                    // Aquí se podría notificar al gateway sobre el fallo
                }
                break;

            case 'resultado.habilidad_ejecutada':
                // La habilidad se ejecutó con éxito, ahora completamos la tarea.
                await updateTaskState(taskId, 'COMPLETADA');
                console.log(`[${taskId}] Tarea completada con resultado: ${payload.resultado}`);
                // Aquí notificaríamos al gateway con el resultado final.
                break;

            // El flujo original de PLANIFICANDO queda inactivo por ahora.
            // case 'resultado.plan_generado':
            //     await updateTaskState(taskId, 'ESPERANDO_APROBACION_PLAN');
            //     console.log(`[${taskId}] Plan generado. Esperando aprobación.`);
            //     break;
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

function analizarPrompt(prompt) {
    // Análisis simple para Hito 3. Identifica habilidad existente o brecha de capacidad.
    return new Promise((resolve, reject) => {
        prompt = prompt.toLowerCase();

        // --- 1. Buscar habilidades existentes (sumar) ---
        const regexSuma1 = /cuánto es (\d+) \+ (\d+)/;
        const regexSuma2 = /suma (\d+) y (\d+)/;

        let matchSuma = prompt.match(regexSuma1) || prompt.match(regexSuma2);

        if (matchSuma) {
            const params = {
                a: parseInt(matchSuma[1], 10),
                b: parseInt(matchSuma[2], 10)
            };
            // Encontramos una habilidad que SÍ tenemos
            return resolve({ analysis: 'SKILL_FOUND', skillId: 'sumar', params });
        }

        // --- 2. Buscar brechas de capacidad conocidas (multiplicar) ---
        const regexMult1 = /multiplica (\d+) por (\d+)/;
        let matchMult = prompt.match(regexMult1);

        if (matchMult) {
            // Encontramos una habilidad que NO tenemos
            return resolve({ analysis: 'CAPACITY_GAP', missingSkill: 'multiplicar' });
        }

        // --- 3. Si no se reconoce nada ---
        reject(new Error("Prompt no reconocido. No se pudo identificar ni una habilidad existente ni una brecha de capacidad conocida."));
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

function executeSkill(skillId, params) {
    // Esta función ejecutará la habilidad solicitada.
    // Por ahora, solo tenemos la lógica para 'sumar'.
    return new Promise((resolve, reject) => {
        if (skillId !== 'sumar') {
            return reject(new Error(`Habilidad desconocida: ${skillId}`));
        }

        const { a, b } = params;
        if (typeof a !== 'number' || typeof b !== 'number') {
            return reject(new Error('Parámetros inválidos para la habilidad sumar. Se esperan dos números.'));
        }

        const result = a + b;
        console.log(`Resultado de la habilidad ${skillId}: ${result}`);
        resolve(result);
    });
}


// --- Iniciar Servicio ---
connectToRabbitMQ();
