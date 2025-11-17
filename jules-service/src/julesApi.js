
const axios = require('axios');
const config = require('./config');

const api = axios.create({
    baseURL: config.julesApiBaseUrl,
    headers: {
        'X-Goog-Api-Key': config.apiKey,
        'Content-Type': 'application/json'
    }
});

/**
 * Creates a new session in the Jules API.
 * @param {string} prompt The user's prompt.
 * @param {string} sourceName The source name for the repository.
 * @param {string} branchName The branch to work on.
 * @returns {Promise<object>} The session data from the API.
 */
async function createSession(prompt, sourceName, branchName) {
    const sessionData = {
        prompt,
        sourceContext: {
            source: sourceName,
            githubRepoContext: { startingBranch: branchName }
        },
        requirePlanApproval: false
    };
    const response = await api.post('/sessions', sessionData);
    return response.data;
}

/**
 * Fetches the activities for a given session.
 * @param {string} sessionName The name of the session.
 * @returns {Promise<Array>} A list of activities.
 */
async function getActivities(sessionName) {
    const response = await api.get(`/${sessionName}/activities`, {
        params: { pageSize: config.pollPageSize }
    });
    return response.data.activities || [];
}

/**
 * Sends a message to an existing Jules session.
 * @param {string} sessionName The name of the session.
 * @param {string} prompt The message to send.
 * @returns {Promise<object>} The (usually empty) response from the API.
 */
async function sendMessage(sessionName, prompt) {
    const response = await api.post(`/${sessionName}:sendMessage`, { prompt });
    return response.data;
}

module.exports = {
    createSession,
    getActivities,
    sendMessage,
};
