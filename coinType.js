"use strict";

let Enum = require('enum');

const coinType = new Enum({ 'b': 'BTC', 'e': 'ETH', 'x': 'XRP', 'c': 'BCH' });

// exports.coinTypes = coinType.enums.map((c) => c.value);

module.exports = Object.freeze(coinType);
