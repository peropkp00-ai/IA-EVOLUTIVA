
require('dotenv').config();

const config = {
    port: process.env.PORT || 7700,
    apiKey: process.env.API_KEY,
    sourceName: process.env.SOURCE_NAME,
    branchName: process.env.BRANCH_NAME,
    pollInterval: parseInt(process.env.POLL_INTERVAL, 10) || 5000,
    maxPollRetries: parseInt(process.env.MAX_POLL_RETRIES, 10) || 120,
    pollPageSize: parseInt(process.env.POLL_PAGE_SIZE, 10) || 50,
    julesApiBaseUrl: 'https://jules.googleapis.com/v1alpha',
};

if (!config.apiKey) {
    console.error("Error: Falta la variable de entorno API_KEY. El servicio no puede iniciar.");
    process.exit(1);
}

module.exports = config;
