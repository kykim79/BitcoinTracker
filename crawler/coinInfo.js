'use strict';
let roundTo = require('round-to');
let empty = require('is-empty');

const PRICE_ROUND_RADIX = Number(process.env.PRICE_ROUND_RADIX);

const add = (e1, e2) => e1 + e2;

module.exports = class CoinInfo {
    constructor (content) {
        if(empty(content)) {
            throw new Error('empty content');
        }

        try {
            this.epoch = new Date(content[0].transaction_date).getTime();
            this.volume = roundTo(content.map((e) => Number(e.units_traded)).reduce(add), 8);
            this.price = roundTo(content.map((e) => Number(e.total)).reduce(add) / this.volume, PRICE_ROUND_RADIX);
        } catch(exception) {
            throw new Error('Failed to make object. ' + exception);
        }
    }

    toString() {
        return [this.epoch, this.price, this.volume].join(', ');
    }
};
