"use strict";

let Enum = require('enum');

const tradeType = new Enum(['BUY', 'SELL']);

module.exports = Object.freeze(tradeType);