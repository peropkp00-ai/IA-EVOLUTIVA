// services/orchestrator-service/index.test.js

// Mock de la base de datos antes de importar el módulo principal
jest.mock('sqlite3', () => ({
  verbose: jest.fn().mockReturnThis(),
  Database: jest.fn(() => ({
    run: jest.fn((sql, params, callback) => callback(null)),
    close: jest.fn(),
  })),
}));

// Mock de amqplib
const mockSendToQueue = jest.fn();
const mockConsume = jest.fn();
jest.mock('amqplib', () => ({
  connect: jest.fn(() => ({
    createChannel: jest.fn(() => ({
      assertQueue: jest.fn(),
      sendToQueue: mockSendToQueue,
      consume: mockConsume,
    })),
  })),
}));

// Importar el módulo principal DESPUÉS de los mocks
const { handleMessage } = require('./index');

describe('Orchestrator Service Logic', () => {

  beforeEach(() => {
    // Limpiar los mocks antes de cada prueba
    mockSendToQueue.mockClear();
    mockConsume.mockClear();
  });

  test('debe procesar tarea.crear y publicar tarea.generar_plan', async () => {
    // 1. Datos de Entrada (Evento Simulado)
    const taskId = 'test-task-123';
    const prompt = 'Crear una función de suma';
    const fakeMsg = {
      content: Buffer.from(JSON.stringify({
        metadata: { taskId },
        payload: {
          nombreEvento: 'tarea.crear',
          prompt: prompt,
        },
      })),
    };

    // 2. Ejecutar la Función
    await handleMessage(fakeMsg);

    // 3. Verificación
    // Verificar que se intentó publicar un mensaje
    expect(mockSendToQueue).toHaveBeenCalledTimes(1);

    // Verificar el contenido del mensaje publicado
    const sentMsgBuffer = mockSendToQueue.mock.calls[0][1];
    const sentMsg = JSON.parse(sentMsgBuffer.toString());

    expect(sentMsg.payload.nombreEvento).toBe('tarea.generar_plan');
    expect(sentMsg.payload.prompt).toBe(prompt);
    expect(sentMsg.metadata.taskId).toBe(taskId);
  });
});
