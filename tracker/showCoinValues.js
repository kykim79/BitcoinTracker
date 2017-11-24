
const fs = require('fs');
const pad = require('pad');
const numeral = require('numeral');

const coinConfig = require('./coinConfig.js');
const moment = require('moment');
const CURRENCY = process.env.CURRENCY;
const currency = CURRENCY.toLowerCase();

const NPAD_SIZE = Number(process.env.NPAD_SIZE);
const npad = (number) => pad(NPAD_SIZE, numeral((number)).format('0,0'));
const npadBlank = (number) => pad(NPAD_SIZE + 7, numeral((number)).format('0,0'));
const npercent = (number) => numeral(number * 100).format('0,0.00') + '%';
const CONFIG = process.env.CONFIG;  // configuration folder with '/'
const CONFIG_FILENAME = 'trackerConfig.json';

let log4js = require('log4js');
const logger = log4js.getLogger('showCoinValues');

exports.attach = (nv) => buildAttach(nv);

function buildAttach(nv) {
    try {
        const cf = JSON.parse(fs.readFileSync(CONFIG + currency + '/' + CONFIG_FILENAME));
        return new coinConfig(CURRENCY)
            .addField('Buy:     ', npercent((nv.close - cf.buyPrice ) / nv.close), npadBlank(cf.buyPrice) )
            .addField('histo(avr) ', npad(nv.histoAvr), npadBlank(cf.histoPercent * nv.close) + '(' + npercent(cf.histoPercent) + ')')

            .addField('Now : ', moment(new Date(nv.epoch)).tz('Asia/Seoul').format('MM-DD HH:mm'), npad(nv.close))
            .addField('gapAllow ', npercent(cf.gapAllowance), npadBlank(cf.gapAllowance * nv.close))

            .addField('Sell:     ', npercent((cf.sellPrice - nv.close) / nv.close), npadBlank(cf.sellPrice))
            .addField('Volume ;  avr ', '', numeral(nv.volume).format('0,0.00') + ' ; ' + numeral(nv.volumeAvr).format('0,0.00') + '\n + ' +
                'last ' + numeral(nv.volumeLast).format('0,0.00') + ' (' + numeral(nv.volumeLast / nv.volumeAvr * 100).format('0,0') + '%' + ')')

            .addField('d, k', ' (' + numeral(nv.dLast).format('0') + ', ' + numeral(nv.kLast).format('0') + ')' ,
                '  => (' + numeral(nv.dNow).format('0') + ', ' + numeral(nv.kNow).format('0') + ')')
        ;
    } catch (e) {
        throw new Error(e);
    }
}

