
const WebSocket = require('ws');
const config = require('./config');
const julesApi = require('./julesApi');
const logger = require('./logger');

// Map to keep track of active polling loops
// Key: sessionName, Value: { ws: WebSocket, logger: ChildLogger }
const activeSessions = new Map();

/**
 * Initializes the WebSocket server and attaches it to the HTTP server.
 * @param {http.Server} server The HTTP server instance.
 */
function initializeWebSocketServer(server) {
    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws) => {
        logger.info('Client connected via WebSocket.');
        // Keep track of sessions managed by this specific client
        ws.managedSessions = new Set();

        ws.on('message', (message) => {
            handleClientMessage(message, ws);
        });

        ws.on('close', () => {
            logger.info('Client disconnected. Cleaning up associated sessions.');
            // Clean up any polling loops associated with the disconnected client
            for (const sessionName of ws.managedSessions) {
                if (activeSessions.has(sessionName)) {
                    activeSessions.delete(sessionName);
                    logger.info({ sessionName }, 'Stopped polling for disconnected client.');
                }
            }
        });

        ws.on('error', (error) => {
            logger.error(error, 'WebSocket error');
        });
    });
}

/**
 * Parses and routes incoming messages from a WebSocket client.
 * @param {string} message The raw message from the client.
 * @param {WebSocket} ws The WebSocket connection instance.
 */
async function handleClientMessage(message, ws) {
    try {
        const data = JSON.parse(message);
        logger.info({ clientMessage: data }, 'Received message from client');

        switch (data.type) {
            case 'start':
                if (data.prompt) {
                    await handleStartCommand(data, ws);
                } else {
                    sendError(ws, 'El comando "start" requiere un "prompt".');
                }
                break;

            case 'sendMessage':
                if (data.sessionName && data.prompt) {
                    await handleSendMessageCommand(data, ws);
                } else {
                    sendError(ws, 'El comando "sendMessage" requiere un "sessionName" y un "prompt".');
                }
                break;

            default:
                sendError(ws, `Tipo de mensaje no reconocido: "${data.type}".`);
                break;
        }
    } catch (error) {
        logger.error(error, 'Failed to parse client message');
        sendError(ws, 'Mensaje en formato JSON inválido.');
    }
}

/**
 * Handles the "start" command to create and begin polling a new session.
 */
async function handleStartCommand(data, ws) {
    const { prompt, sourceName, branchName } = data;
    const currentSourceName = sourceName || config.sourceName;
    const currentBranchName = branchName || config.branchName;

    try {
        const session = await julesApi.createSession(prompt, currentSourceName, currentBranchName);
        const sessionName = session.name;

        // Associate session with this client connection
        ws.managedSessions.add(sessionName);
        const childLogger = logger.child({ sessionName });
        activeSessions.set(sessionName, { ws, logger: childLogger });

        ws.send(JSON.stringify({
            type: 'session_created',
            message: `Session created: ${sessionName}. Now watching for updates.`,
            session: session
        }));

        pollAndPushUpdates(sessionName);

    } catch (error) {
        const errorMessage = error.response ? error.response.data : { error: error.message };
        logger.error({ err: errorMessage }, "Error creating session");
        sendError(ws, 'Fallo al crear la sesión.', errorMessage);
        ws.close();
    }
}

/**
 * Handles the "sendMessage" command to interact with an ongoing session.
 */
async function handleSendMessageCommand(data, ws) {
    const { sessionName, prompt } = data;

    if (!activeSessions.has(sessionName)) {
        return sendError(ws, `La sesión "${sessionName}" no está activa o no existe.`);
    }
    
    try {
        await julesApi.sendMessage(sessionName, prompt);
        logger.info({ sessionName }, 'Message sent to session successfully.');
        // The existing poller will pick up the response
    } catch (error) {
        const errorMessage = error.response ? error.response.data : { error: error.message };
        logger.error({ err: errorMessage, sessionName }, "Error sending message to session");
        sendError(ws, 'Fallo al enviar el mensaje.', errorMessage);
    }
}


/**
 * Polls a Jules session and pushes real-time updates to the client via WebSocket.
 */
async function pollAndPushUpdates(sessionName) {
    const sessionInfo = activeSessions.get(sessionName);
    if (!sessionInfo) {
        logger.warn({ sessionName }, 'Polling stopped because session is no longer active.');
        return;
    }
    const { ws, logger: childLogger } = sessionInfo;
    
    let retries = 0;
    const processedActivityIds = new Set();

    childLogger.info('Starting to poll session');

    while (retries < config.maxPollRetries && activeSessions.has(sessionName) && ws.readyState === WebSocket.OPEN) {
        let hasNewActivity = false;
        try {
            const activities = await julesApi.getActivities(sessionName);

            for (const activity of activities) {
                if (processedActivityIds.has(activity.id)) continue;

                hasNewActivity = true;
                processedActivityIds.add(activity.id);

                const summary = getLatestActivitySummary(activity);
                childLogger.info({ activityStatus: summary.status, activityId: activity.id }, 'Pushing status update to client');
                ws.send(JSON.stringify({ type: 'status_update', ...summary }));

                if (summary.status === 'SESSION_COMPLETED' || summary.status === 'SESSION_FAILED') {
                    childLogger.info('Terminal state reached. Stopping poller.');
                    activeSessions.delete(sessionName);
                    ws.close();
                    return;
                }
            }
        } catch (error) {
            childLogger.error(error, 'Error polling session');
        }

        if (!hasNewActivity) {
            retries++;
        } else {
            retries = 0;
        }

        await new Promise(resolve => setTimeout(resolve, config.pollInterval));
    }

    if (activeSessions.has(sessionName)) {
        childLogger.warn('Polling timed out.');
        sendError(ws, 'El sondeo ha expirado.');
        activeSessions.delete(sessionName);
        ws.close();
    }
}

function getLatestActivitySummary(activity) {
    const summary = {
        activityId: activity.id,
        createTime: activity.createTime,
        originator: activity.originator,
    };

    if (activity.sessionCompleted) {
        summary.status = 'SESSION_COMPLETED';
        summary.details = 'La sesión ha finalizado con éxito.';
        summary.outputs = [];
        if (activity.artifacts) {
            for (const artifact of activity.artifacts) {
                if (artifact.pullRequest) summary.outputs.push({ type: 'pullRequest', ...artifact.pullRequest });
                if (artifact.changeSet && artifact.changeSet.suggestedCommitMessage) summary.outputs.push({ type: 'commitMessage', message: artifact.changeSet.suggestedCommitMessage });
            }
        }
    } else if (activity.sessionFailed) {
        summary.status = 'SESSION_FAILED';
        summary.details = activity.sessionFailed.error || 'La sesión ha fallado.';
    } else if (activity.planGenerated) {
        summary.status = 'PLAN_GENERATED';
        summary.details = `Plan generado con ${activity.planGenerated.plan.steps.length} pasos.`;
    } else if (activity.progressUpdated) {
        summary.status = 'PROGRESS_UPDATED';
        summary.details = activity.progressUpdated.title || 'Actualización de progreso.';
    } else if (activity.agentMessaged) {
        summary.status = 'AGENT_MESSAGED';
        summary.details = 'El agente ha enviado un mensaje.';
    } else if (activity.planApproved) { // Added specific check for planApproved
        summary.status = 'PLAN_APPROVED';
        summary.details = `Plan ${activity.planApproved.planId || 'desconocido'} aprobado.`;
    } else {
        summary.status = 'UNKNOWN_ACTIVITY';
        summary.details = 'Actividad no reconocida.';
    }
    return summary;
}

function sendError(ws, message, details = null) {
    const errorPayload = { type: 'error', message, details };
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(errorPayload));
    }
    logger.warn(errorPayload, 'Sent error to client');
}

module.exports = { initializeWebSocketServer };
