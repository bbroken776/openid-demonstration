// logger.js
// Centralized logger based on pino, with pretty output and friendly, multi-line messages.

const pino = require('pino');

const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      singleLine: false,
    },
  },
});

// Helper para formatar o bloco de log de forma consistente.
function formatBlock(levelLabel, message, meta) {
  const lines = [];

  // Cabeçalho
  lines.push(`─ ${levelLabel}: ${message}`);

  // Campos extra (meta)
  if (meta && typeof meta === 'object' && Object.keys(meta).length > 0) {
    for (const [key, value] of Object.entries(meta)) {
      lines.push(`  • ${key}: ${JSON.stringify(value)}`);
    }
  }

  // Linha em branco no fim para separar blocos
  lines.push('');

  return lines.join('\n');
}

const logger = {
  info(message, meta) {
    baseLogger.info({}, '\n' + formatBlock('INFO', message, meta));
  },
  warn(message, meta) {
    baseLogger.warn({}, '\n' + formatBlock('WARN', message, meta));
  },
  error(message, meta) {
    baseLogger.error({}, '\n' + formatBlock('ERROR', message, meta));
  },
  debug(message, meta) {
    baseLogger.debug({}, '\n' + formatBlock('DEBUG', message, meta));
  },

  auth(message, meta) {
    const data = { area: 'auth', ...(meta || {}) };
    baseLogger.info({}, '\n' + formatBlock('AUTH', message, data));
  },

  route(message, meta) {
    const data = { area: 'route', ...(meta || {}) };
    baseLogger.info({}, '\n' + formatBlock('ROUTE', message, data));
  },

  session(message, meta) {
    const data = { area: 'session', ...(meta || {}) };
    baseLogger.debug({}, '\n' + formatBlock('SESSION', message, data));
  },
};

module.exports = logger;
