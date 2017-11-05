'use strict';

let Enum = require('enum');

const coinType = new Enum({ 'b': 'BTC', 'e': 'ETH', 'x': 'XRP', 'c': 'BCH'});
// const coinType = new Enum({ 'b': 'BTC', 'e': 'ETH', 'x': 'XRP', 'c': 'BCH' , 'g': 'BTG' });

module.exports = Object.freeze(coinType);
