const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:7700');

let sessionName = null;
let messageSent = false;

ws.on('open', function open() {
  console.log('CLIENT: Conectado a jules-service.');

  const startTask = {
    type: 'start',
    prompt: 'Crea un archivo simple llamado `app.js` que solo contenga un console.log("Hola Agente").'
  };

  console.log('CLIENT: Enviando tarea inicial...');
  ws.send(JSON.stringify(startTask));
});

ws.on('message', function message(data) {
  try {
    const response = JSON.parse(data);
    console.log('\n--- ACTUALIZACIÓN DEL SERVICIO ---');
    console.log(JSON.stringify(response, null, 2));
    console.log('----------------------------------\n');

    // --- Lógica para enviar un segundo mensaje ---
    if (response.type === 'session_created') {
      sessionName = response.session.name;
      console.log(`CLIENT: Sesión creada (${sessionName}). Esperando a que el plan sea generado para enviar un mensaje de seguimiento...`);
    }

    if (response.type === 'status_update' && response.status === 'PLAN_GENERATED' && sessionName && !messageSent) {
      messageSent = true; // Set flag to true to prevent sending multiple messages
      console.log(`CLIENT: Plan generado para la sesión ${sessionName}. Enviando mensaje de seguimiento...`);
      
      const followUpMessage = {
        type: 'sendMessage',
        sessionName: sessionName,
        prompt: 'Por favor, añade un segundo console.log que diga "Tarea modificada".'
      };
      ws.send(JSON.stringify(followUpMessage));
    }
    // -----------------------------------------

  } catch (e) {
    console.log('CLIENT: Datos recibidos (no-JSON):', data.toString());
  }
});

ws.on('close', function close() {
  console.log('CLIENT: Desconectado de jules-service.');
});

ws.on('error', function error(err) {
  console.error('CLIENT: Error de WebSocket:', err.message);
});