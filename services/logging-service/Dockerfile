FROM node:18-alpine\nWORKDIR /usr/src/app\nCOPY package*.json ./\nRUN npm install\nCOPY . .\nCMD ["node", "index.js"]
