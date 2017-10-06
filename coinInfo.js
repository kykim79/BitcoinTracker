"use strict";
var roundTo = require('round-to');
var empty = require('is-empty');
const add = (e1, e2) => e1 + e2;

module.exports = class CoinInfo {
  constructor (content) {
    if(empty(content)) {
      throw new Error('empty content');      
    }

    if (empty(content.data)) {
      throw new Error('empty content.data');
    }
    
    try {
      const data = content.data;
      this.epoch = new Date(data[0].transaction_date).getTime();
      this.volume = roundTo(data.map((e) => Number(e.units_traded)).reduce(add), 2);
      this.price = roundTo(data.map((e) => Number(e.total)).reduce(add) / this.volume, -2);      
    } catch(exception) {
      throw new Error('Failed to make object. ' + exception);
    }
  }
  
  toString() {
    return [this.epoch, this.price, this.volume].join(', ');
  }
};
