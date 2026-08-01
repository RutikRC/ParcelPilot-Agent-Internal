const util = require("util");

const formatMeta = (meta) => {
  if (!meta) return "";
  return typeof meta === "string" ? ` | ${meta}` : ` | ${util.inspect(meta, { depth: 5, compact: true })}`;
};

const formatMessage = (level, message, meta) => {
  const timestamp = new Date().toISOString();
  const text = typeof message === "string" ? message : util.inspect(message, { depth: 5, compact: true });
  return `${timestamp} | ${level} | ${text}${formatMeta(meta)}`;
};

const logger = {
  info: (message, meta) => {
    console.log(formatMessage("INFO", message, meta));
  },
  warn: (message, meta) => {
    console.warn(formatMessage("WARN", message, meta));
  },
  error: (message, meta) => {
    console.error(formatMessage("ERROR", message, meta));
  },
  debug: (message, meta) => {
    console.debug(formatMessage("DEBUG", message, meta));
  },
};

module.exports = logger;
