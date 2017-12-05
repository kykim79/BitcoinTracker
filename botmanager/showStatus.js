
const fs = require('fs');
const momenttimezone = require('moment-timezone');
const pad = require('pad');
const numeral = require('numeral');
const roundTo = require('round-to');
const bhttp = require('bhttp');
const Promise = require('bluebird');

const coinConfig = require('./coinConfig.js');
const replier = require('./replier.js');

const NPAD_SIZE = Number(process.env.NPAD_SIZE);
const npadBlank = (number) => pad(NPAD_SIZE + 5, numeral((number)).format('0,0'));
const npercent = (number) => numeral(number * 100).format('0,0.00') + '%';
const BITHUMB_URL = 'https://api.bithumb.com/public/recent_transactions/';

// CONFIGRATION && LOGGER
const CONFIG = process.env.CONFIG;  // configuration folder with '/'
const CONFIG_FILENAME = process.env.CONFIG_FILENAME;

let log4js = require('log4js');
const logger = log4js.getLogger('showstatus');
const LOG = process.env.LOG;
const TREND_FILENAME =  process.env.TREND_FILENAME;

exports.info = (coin, msg) => showCoinStatus(coin, msg);
exports.attach = (coin, value) => buildAttach(coin, value);

function showCoinStatus(coin, msg) {
    const response = (value) => buildAttach(coin, value);
    Promise.try(() => bhttp.get(BITHUMB_URL +  coin))
        .then(response)
        .then(attach => {
            replier.sendAttach(coin, msg, [attach]);
        })
        .catch(e => logger.error(e));
}

function buildAttach(coin, value) {
    try {
        const cf = JSON.parse(fs.readFileSync(CONFIG + coin.toLowerCase() + '/' + CONFIG_FILENAME));
        const nowPrice = Number(value.body.data[0].price);
        const volume = value.body.data.map(_ => Number(_.units_traded)).reduce((e1, e2) => e1 + e2);
        let short = true;
        let trendLastTitle = '';
        let trendLastText = '';
        const stats = fs.statSync(LOG + coin.toLowerCase() + '/' + TREND_FILENAME);
        if ((new Date() - stats.mtime) > 600000) {    // if last trend log is before 10 min, then
            trendLastTitle = 'Tracker stopped ' +  + roundTo((new Date() - stats.mtime) / 60000,0) + ' min. ago' ;
            trendLastText = 'Last trend log time is  ' + momenttimezone(new Date(stats.mtime)).tz('Asia/Seoul').format('YY-MM-DD HH:mm');
            short = false;
        }

        return new coinConfig(coin)
            .addField('Buy:     ' + npercent((nowPrice - cf.buyPrice ) / nowPrice), npadBlank(cf.buyPrice))
            .addField('gapAllow ' + npercent(cf.gapAllowance), npadBlank(cf.gapAllowance * nowPrice))
            .addField('Now:', npadBlank(nowPrice))
            .addField('histo(div) ' + npercent(cf.histoPercent), npadBlank(cf.histoPercent * nowPrice))
            .addField('Sell:     ' + npercent((cf.sellPrice - nowPrice) / nowPrice),  npadBlank(cf.sellPrice))
            .addField('volume ', '        ' + numeral(volume).format('0,0.00'))
            .addField(trendLastTitle,trendLastText, short)
        ;
    } catch (e) {
        throw new Error(e);
    }
}
