const pino = require('pino');

const transport = pino.transport ? pino.transport({ target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard', singleLine: false } }) : undefined;

const logger = pino({ level: process.env.LOG_LEVEL || 'info' }, transport);

function formatBlock(title, obj = {}) {
  return { title, ...obj };
}

module.exports = {
  info: (msg, obj = {}) => logger.info(formatBlock(msg, obj)),
  warn: (msg, obj = {}) => logger.warn(formatBlock(msg, obj)),
  error: (msg, obj = {}) => logger.error(formatBlock(msg, obj)),
  debug: (msg, obj = {}) => logger.debug(formatBlock(msg, obj)),
  auth: (msg, obj = {}) => logger.info(formatBlock(`[auth] ${msg}`, obj)),
  route: (msg, obj = {}) => logger.debug(formatBlock(`[route] ${msg}`, obj)),
  session: (msg, obj = {}) => logger.debug(formatBlock(`[session] ${msg}`, obj)),
};

