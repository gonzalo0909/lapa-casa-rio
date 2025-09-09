"use strict";

/**
 * services/logger.js
 * Logging centralizado con Winston
 */

const { createLogger, format, transports } = require("winston");
const path = require("path");

const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: format.combine(
    format.timestamp(),
    format.printf(({ level, message, timestamp }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: path.join("logs", "error.log"), level: "error" }),
    new transports.File({ filename: path.join("logs", "combined.log") })
  ]
});

// Middleware de Express
function requestLogger(req, _res, next) {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
}

module.exports = { logger, requestLogger };
