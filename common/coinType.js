'use strict';

let Enum = require('enum');

const coinType = new Enum({ 'b': 'BTC', 'x': 'XRP', 'e': 'ETH', 'c': 'BCH'});
// just for prot # reference ({ 'b': 4000, 'x': 4001,  'e': 4002, 'c': 4003 , 'g': 4004 });

module.exports = Object.freeze(coinType);
