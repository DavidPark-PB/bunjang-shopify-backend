const winston = require('winston');
const config = require('../config');

const logger = winston.createLogger({
  level: config.server.env === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'bunjang-shopify-backend' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          ({ level, message, timestamp, ...metadata }) => {
            let msg = `${timestamp} [${level}]: ${message}`;
            if (Object.keys(metadata).length > 0) {
              try {
                // Remove circular references before stringifying
                const cleanMetadata = JSON.parse(JSON.stringify(metadata, (key, value) => {
                  if (value instanceof Error) {
                    return {
                      message: value.message,
                      stack: value.stack,
                      name: value.name
                    };
                  }
                  return value;
                }));
                msg += ` ${JSON.stringify(cleanMetadata)}`;
              } catch (err) {
                msg += ` [Metadata error: ${err.message}]`;
              }
            }
            return msg;
          }
        )
      ),
    }),
  ],
});

// If in production, also write to file
if (config.server.env === 'production') {
  logger.add(
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' })
  );
  logger.add(new winston.transports.File({ filename: 'logs/combined.log' }));
}

module.exports = logger;
