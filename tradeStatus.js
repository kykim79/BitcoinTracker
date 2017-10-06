"use strict";

const log4js = require('log4js');
const logger = log4js.getLogger('tradeStatus');
const TradeType = require('./tradeType.js');
const roundTo = require('round-to');
const pad = require('pad');
const numeral = require('numeral');

const format = require('string-format');
format.extend(String.prototype);

const npad = (e) => pad(10, numeral((e)).format('0,0'));
const updownEMA = (e, i) => e[i].ema > e[i + 1].ema ? 'U' : 'D';
const updownPrice = (e, i) => e[i].price > e[i + 1].price ? 'U' : 'D';
const updownClose = (e, i) => e[i].close > e[i].open ? 'U' : 'D';


module.exports = class TradeStatus {
  constructor(priceInfos, target) {
    
    // 첫번째가 최신데이터임..
    // priceInfos  = 
    // [
    //    {epoch, price, volume, date, high, low, close, open, ema},
    //    {epoch, price, volume, date, high, low, close, open, ema}
    //   ... cnt = 12 hour / 10
    //]
    
    this.title = '';

    this.lastInfo = priceInfos[0];
    this.nowPrice = this.lastInfo.price; 
    
    this.volumeNow = priceInfos.map(_ => _.volume).reduce((e1, e2) => (e1 + e2));
    this.isHighVolume = (this.volumeNow > target.volumeHigh) ? true:false;

    const changeArray = [updownEMA(priceInfos, 0), updownEMA(priceInfos, 1), updownEMA(priceInfos, 2), ''];
    this.changes = changeArray.slice().reverse().join('');
    
    const changeStat = [updownEMA(priceInfos, 4), updownEMA(priceInfos, 3), updownEMA(priceInfos, 2), updownEMA(priceInfos,1), updownEMA(priceInfos, 0)];
    this.changeLong = changeStat.slice().join('');

    this.isDDD = this.changes == 'DDD';
    this.isDDU = this.changes == 'DDU';
    this.isDUU = this.changes == 'DUU';
    this.isUUU = this.changes == 'UUU';
    this.isUUD = this.changes == 'UUD';
    this.isUDD = this.changes == 'UDD';
    
    this.isnowEMAUp = updownEMA(priceInfos, 0) == 'U';
    this.isnowEMADn = updownEMA(priceInfos, 0) == 'D';
    
    this.isCloseUp = this.lastInfo.open < this.lastInfo.close;
    this.isCloseDn = this.lastInfo.open > this.lastInfo.close;
    
    this.isOverSell = this.lastInfo.price > target.sell;
    this.isUnderBuy = this.lastInfo.price < target.buy;
    
    this.emaGap = Math.abs(roundTo(this.nowPrice - this.lastInfo.ema,0));

    logger.debug('tradeStatus {lastInfo.date}, chg:{changeLong}, vol:{volumeNow}, gap:{emaGap}'.format(this));

    if (this.isOverSell || this.isUnderBuy) {
      const priceStat = [updownPrice(priceInfos, 4), updownPrice(priceInfos, 3), updownPrice(priceInfos, 2), updownPrice(priceInfos, 1), updownPrice(priceInfos, 0)];
      priceInfos.slice(0, 5).reverse().forEach((e, i) => {
        logger.debug(e.date + npad(e.price) + ' ' + priceStat[i] + ' ' + npad(e.ema) + ' ' + changeStat[i] + ' ' + roundTo(e.volume,2));
      });
    }
  }
};