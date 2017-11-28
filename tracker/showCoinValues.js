
const fs = require('fs');
const pad = require('pad');
const numeral = require('numeral');
const moment = require('moment');

const coinConfig = require('./coinConfig.js');
const CURRENCY = process.env.CURRENCY;
const currency = CURRENCY.toLowerCase();

const NPAD_SIZE = Number(process.env.NPAD_SIZE);
const npad = (number) => pad(NPAD_SIZE, numeral((number)).format('0,0'));
const npadBlank = (number) => pad(NPAD_SIZE + 5, numeral((number)).format('0,0'));
const npercent = (number) => numeral(number * 100).format('0,0.00') + '%';
const ndiff = (nbase, number) => npad(number) + '(' + numeral((nbase - number) / nbase * 100).format('0.0')+'%)';
const CONFIG = process.env.CONFIG;  // configuration folder with '/'
const CONFIG_FILENAME = process.env.CONFIG_FILENAME;

exports.attach = (nv) => buildAttach(nv);

function buildAttach(nv) {
    try {
        const cf = JSON.parse(fs.readFileSync(CONFIG + currency + '/' + CONFIG_FILENAME));
        return new coinConfig(CURRENCY)
            // .addField('Now : ' + npad(nv.close) + '    < ' + ndiff(nv.close, nv.closeLast1),
            //     '< ' + ndiff(nv.close, nv.closeLast2) + ' < ' + ndiff(nv.close, nv.closeLast3), false) // false means long

            .addField('Now : ' + npad(nv.close) + ' ' + moment(new Date(nv.epoch)).tz('Asia/Seoul').format('HH:mm'),
                '< ' + ndiff(nv.close, nv.closeLast1) + ' ' + moment(new Date(nv.closeLast1epoch)).tz('Asia/Seoul').format('HH:mm') + '\n' +
                '< ' + ndiff(nv.close, nv.closeLast2) + ' ' + moment(new Date(nv.closeLast2epoch)).tz('Asia/Seoul').format('HH:mm') + '\n'  +
                '< ' + ndiff(nv.close, nv.closeLast3) + ' ' + moment(new Date(nv.closeLast3epoch)).tz('Asia/Seoul').format('HH:mm'), false) // false means long

            .addField('Buy:     ' + npercent((nv.close - cf.buyPrice ) / nv.close), npadBlank(cf.buyPrice) )
            .addField('histo(avr) ' + npad(nv.histoAvr),
                ((nv.histoSign) ? '+/-' : '') + '  ' + numeral(cf.histoPercent * nv.close).format('0,0') + ' (' + npercent(cf.histoPercent) + ')')

            .addField('Sell:     ' + npercent((cf.sellPrice - nv.close) / nv.close), npadBlank(cf.sellPrice) + '\n' +
                'd,k(' + numeral(nv.dLast).format('0') + ',' + numeral(nv.kLast).format('0') + ':' +
                numeral(nv.dNow).format('0') + ',' + numeral(nv.kNow).format('0') + ')')
            .addField('Volume (avr/last)', numeral(nv.volume).format('0,0.0')  +
                '  (' + numeral(nv.volumeLast / nv.volumeAvr * 100).format('0,0') + '%)\n'  +
                numeral(nv.volumeAvr).format('0,0.0') + ' / ' + numeral(nv.volumeLast).format('0,0.0'))

            .addField('gapAllow ' + npercent(cf.gapAllowance), npadBlank(cf.gapAllowance * nv.close))
        ;
    } catch (e) {
        throw new Error(e);
    }
}

