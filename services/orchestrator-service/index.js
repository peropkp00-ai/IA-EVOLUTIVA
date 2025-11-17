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
const RESULTADOS_TOPIC = 'topico.resultados';
const DB_PATH = './orchestrator.db';

// --- Base de Datos ---
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error abriendo la base de datos:', err.message);
    } else {
        console.log('Conectado a la base de datos de estado.');
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

        await channel.assertQueue(TAREAS_TOPIC, { durable: true });
        await channel.assertQueue(RESULTADOS_TOPIC, { durable: true });

        console.log('Orchestrator Service conectado a RabbitMQ');

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
                        await updateTaskState(taskId, 'EJECUTANDO_HABILIDAD');
                        const result = await executeSkill(analysisResult.skillId, analysisResult.params);

                        publishEvent(RESULTADOS_TOPIC, 'resultado.habilidad_ejecutada', metadata, {
                            resultado: result,
                            promptOriginal: payload.prompt
                        });

                    } else if (analysisResult.analysis === 'CAPACITY_GAP') {
                        await updateTaskState(taskId, 'BRECHA_CAPACIDAD_DETECTADA');
                        const habilidadFaltante = analysisResult.missingSkill;
                        console.log(`[${taskId}] Brecha de capacidad detectada. Habilidad faltante: '${habilidadFaltante}'`);

                        const planDeDesarrollo = await generarPlanDeDesarrollo(habilidadFaltante);
                        await updateTaskState(taskId, 'ESPERANDO_APROBACION_PLAN_DESARROLLO');

                        publishEvent(RESULTADOS_TOPIC, 'resultado.plan_desarrollo_generado', metadata, {
                            plan: planDeDesarrollo
                        });
                        console.log(`[${taskId}] Plan de desarrollo generado. Esperando aprobación del usuario.`);
                    }

                } catch (error) {
                    console.error(`[${taskId}] Error en el análisis del prompt:`, error.message);
                    await updateTaskState(taskId, 'FALLIDA_LOGICA');
                }
                break;

            case 'resultado.habilidad_ejecutada':
                await updateTaskState(taskId, 'COMPLETADA');
                console.log(`[${taskId}] Tarea completada con resultado: ${payload.resultado}`);
                break;

            case 'tarea.aprobar_plan_desarrollo':
                await updateTaskState(taskId, 'DESARROLLANDO_HABILIDAD');
                console.log(`[${taskId}] Plan de desarrollo aprobado. Delegando al Herrero...`);
                publishEvent(TAREAS_TOPIC, 'tarea.generar_plan', metadata, {
                    prompt: "Generar la habilidad 'multiplicar' según el plan."
                });
                break;

            case 'resultado.pr_generada':
                await updateTaskState(taskId, 'PROBANDO_INTEGRACION');
                console.log(`[${taskId}] Pull Request generada: ${payload.pullRequestUrl}. Delegando al Sandbox...`);
                break;
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
    return new Promise((resolve, reject) => {
        prompt = prompt.toLowerCase();

        const regexSuma1 = /cuánto es (\d+) \+ (\d+)/;
        const regexSuma2 = /suma (\d+) y (\d+)/;
        let matchSuma = prompt.match(regexSuma1) || prompt.match(regexSuma2);

        if (matchSuma) {
            const params = {
                a: parseInt(matchSuma[1], 10),
                b: parseInt(matchSuma[2], 10)
            };
            return resolve({ analysis: 'SKILL_FOUND', skillId: 'sumar', params });
        }

        const regexMult1 = /multiplica (\d+) por (\d+)/;
        let matchMult = prompt.match(regexMult1);

        if (matchMult) {
            return resolve({ analysis: 'CAPACITY_GAP', missingSkill: 'multiplicar' });
        }

        reject(new Error("Prompt no reconocido."));
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
    return new Promise((resolve, reject) => {
        if (skillId !== 'sumar') {
            return reject(new Error(`Habilidad desconocida: ${skillId}`));
        }

        const { a, b } = params;
        if (typeof a !== 'number' || typeof b !== 'number') {
            return reject(new Error('Parámetros inválidos para la habilidad sumar.'));
        }

        const result = a + b;
        console.log(`Resultado de la habilidad ${skillId}: ${result}`);
        resolve(result);
    });
}

function generarPlanDeDesarrollo(habilidadFaltante) {
    console.log(`Generando plan de desarrollo para la habilidad: ${habilidadFaltante}...`);

    const plan = {
        habilidad: habilidadFaltante,
        pasos: [
            { paso: 1, descripcion: "Definir la especificación de la habilidad." },
            { paso: 2, descripcion: "Escribir el código de la función." },
            { paso: 3, descripcion: "Crear pruebas unitarias." },
            { paso: 4, descripcion: "Validar las pruebas en el sandbox." },
            { paso: 5, descripcion: "Registrar la nueva habilidad." }
        ]
    };

    return Promise.resolve(plan);
}

// --- Iniciar Servicio ---
connectToRabbitMQ();

// Exportar para pruebas
module.exports = {
  handleMessage,
  analizarPrompt,
  executeSkill,
  generarPlanDeDesarrollo,
  updateTaskState,
  createTask,
  publishEvent
};
