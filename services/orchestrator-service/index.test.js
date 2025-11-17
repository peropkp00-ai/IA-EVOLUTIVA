// services/orchestrator-service/index.test.js

// Mock de dependencias externas
jest.mock('sqlite3', () => ({
  verbose: jest.fn().mockReturnThis(),
  Database: jest.fn(() => ({
    run: jest.fn((sql, params, callback) => callback(null)),
    close: jest.fn(),
  })),
}));

const mockSendToQueue = jest.fn();
jest.mock('amqplib', () => ({
  connect: jest.fn(() => ({
    createChannel: jest.fn(() => ({
      assertQueue: jest.fn(),
      sendToQueue: mockSendToQueue,
      consume: jest.fn(),
    })),
  })),
}));

// Importar las funciones a probar DESPUÉS de los mocks
const { handleMessage } = require('./index');

describe('Orchestrator Service Workflows', () => {

  beforeEach(() => {
    mockSendToQueue.mockClear();
  });

  // La prueba del Hito 1 ha quedado obsoleta con la nueva lógica de análisis de prompt.
  // Las pruebas de los Hitos 2, 3 y 4 cubren el comportamiento actual de 'tarea.crear'.

  // --- Hito 2 Prueba ---
  test('Hito 2: Prompt de "suma" debe ejecutar la habilidad y completar la tarea', async () => {
    const fakeMsg = createFakeMessage('tarea.crear', { prompt: 'cuánto es 5 + 3' });
    await handleMessage(fakeMsg);

    // Debe publicar 'resultado.habilidad_ejecutada'
    const sentMsg = getPublishedMessage();
    expect(sentMsg.payload.nombreEvento).toBe('resultado.habilidad_ejecutada');
    expect(sentMsg.payload.resultado).toBe(8);
  });

  // --- Hito 3 y 4 Prueba ---
  test('Hito 3 & 4: Prompt de "multiplica" debe detectar brecha y generar plan', async () => {
    const fakeMsg = createFakeMessage('tarea.crear', { prompt: 'multiplica 5 por 3' });
    await handleMessage(fakeMsg);

    // Debe publicar 'resultado.plan_desarrollo_generado'
    const sentMsg = getPublishedMessage();
    expect(sentMsg.payload.nombreEvento).toBe('resultado.plan_desarrollo_generado');
    expect(sentMsg.payload.plan).toBeDefined();
    expect(sentMsg.payload.plan.habilidad).toBe('multiplicar');
  });

  // --- Hito 5 Prueba ---
  test('Hito 5: Tarea.aprobar_plan_desarrollo debe delegar en el Herrero', async () => {
    const fakeMsg = createFakeMessage('tarea.aprobar_plan_desarrollo', {});
    await handleMessage(fakeMsg);

    // Debe publicar 'tarea.generar_plan' para el herrero
    const sentMsg = getPublishedMessage();
    expect(sentMsg.payload.nombreEvento).toBe('tarea.generar_plan');
    expect(sentMsg.payload.prompt).toContain("Generar la habilidad 'multiplicar'");
  });

});


// --- Funciones de Ayuda para Pruebas ---
function createFakeMessage(nombreEvento, payload) {
  return {
    content: Buffer.from(JSON.stringify({
      metadata: { taskId: `test-${uuidv4()}` },
      payload: {
        nombreEvento,
        ...payload,
      },
    })),
  };
}

function getPublishedMessage() {
  expect(mockSendToQueue).toHaveBeenCalledTimes(1);
  const sentMsgBuffer = mockSendToQueue.mock.calls[0][1];
  return JSON.parse(sentMsgBuffer.toString());
}

// Importar v4 para usarlo en las funciones de ayuda
const { v4: uuidv4 } = require('uuid');

// Helper para generar UUIDs en las pruebas
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));
