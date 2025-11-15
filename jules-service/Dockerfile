# Use a specific version of Node.js on Alpine Linux for a small and secure image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if it exists)
COPY package*.json ./

# Install only production dependencies to keep the final image lean.
# This also improves security by not including development tools in production.
RUN npm install --only=production

# Copy the rest of the application's source code into the container
COPY . .

# Expose the port that the application's health check will run on
EXPOSE 7700

# Define the command to start the application
CMD [ "npm", "start" ]
