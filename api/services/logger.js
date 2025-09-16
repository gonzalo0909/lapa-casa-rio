"use strict";

/**
 * services/logger.js
 * Logging centralizado con Winston, seguro en entornos sin FS persistente
 */

const { createLogger, format, transports } = require("winston");
const path = require("path");
const fs = require("fs");

const logDir = path.join(__dirname, "../../logs");

// Verificar/crear carpeta logs
try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
} catch (err) {
  console.error("⚠️ Error creando carpeta de logs:", err.message);
}

// Winston base
const loggerTransports = [new transports.Console()];

try {
  loggerTransports.push(
    new transports.File({ filename: path.join(logDir, "error.log"), level: "error" }),
    new transports.File({ filename: path.join(logDir, "combined.log") })
  );
} catch (err) {
  console.error("⚠️ Winston file logging deshabilitado:", err.message);
}

const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: format.combine(
    format.timestamp(),
    format.printf(({ level, message, timestamp }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: loggerTransports
});

// Middleware de Express
function requestLogger(req, _res, next) {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
}

module.exports = { logger, requestLogger };
