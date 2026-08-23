const cancellationAction = require("./cancellation.action");
const serviceCreditAction = require("./service-credit.action");
const escalateTicketAction = require("./escalate-ticket.action");

/**
 * Action registry — registers all state-changing actions.
 */
const registry = {};

const register = (action) => {
  registry[action.type] = action;
};

register(cancellationAction);
register(serviceCreditAction);
register(escalateTicketAction);

const get = (type) => registry[type] || null;
const list = () => Object.values(registry).map((a) => ({ type: a.type, metadata: a.metadata }));

module.exports = { register, get, list, registry };