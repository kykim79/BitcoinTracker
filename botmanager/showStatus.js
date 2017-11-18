
const fs = require('fs');
const pad = require('pad');
const numeral = require('numeral');
const bhttp = require('bhttp');
const Promise = require('bluebird');

const coinConfig = require('./coinConfig.js');
const replier = require('./replier.js');
const logger = require('./logger.js').getLogger('showStatus');

const NPAD_SIZE = Number(process.env.NPAD_SIZE);
const npad = (number) => pad(NPAD_SIZE, numeral((number)).format('0,0'));
const npercent = (number) => numeral(number * 100).format('0,0.000') + '%';
const CONFIG = process.env.CONFIG;  // configuration folder with '/'
const CONFIG_FILENAME = '/trackerConfig.json';  // should start with '/'
const BITHUMB_URL = 'https://api.bithumb.com/public/recent_transactions/';

exports.info = (coin, msg) => showCoinStatus(coin, msg);
exports.attach = (coin, value) => buildAttach(coin, value);

function showCoinStatus(coin, msg) {
    const response = (value) => buildAttach(coin, value);
    Promise.try(() => bhttp.get(BITHUMB_URL +  coin))
        .then(response)
        .then(attach => {
            // return replier.sendAttach(coin, msg, [attach]);
            replier.sendAttach(coin, msg, [attach]);
        })
        .catch(e => logger.error(e));
}

function buildAttach(coin, value) {
    try {
        const cf = JSON.parse(fs.readFileSync(CONFIG + coin.toLowerCase() + CONFIG_FILENAME));
        const nowPrice = Number(value.body.data[0].price);
        const volume = value.body.data.map(_ => Number(_.units_traded)).reduce((e1, e2) => e1 + e2);
        const blank = '       ';
        return new coinConfig(coin)
            .addField('Buy:     ', npercent((nowPrice - cf.buyPrice ) / nowPrice), blank + npad(cf.buyPrice))
            .addField('gapAllow ', npercent(cf.gapAllowance), blank + npad(cf.gapAllowance * nowPrice))
            .addField('Now:', '',  blank + npad(nowPrice))
            .addField('histo(div) ', npercent(cf.histoPercent), blank + npad(cf.histoPercent * nowPrice))
            .addField('Sell:     ', npercent((cf.sellPrice - nowPrice) / nowPrice),  blank + npad(cf.sellPrice))
            .addField('volume ', '', blank + numeral(volume).format('0,0.000'))
        ;
    } catch (e) {
        // throw new Error('coin:{0}, value:{1}'.format(coin, value), e);
        throw new Error(e);
    }
}

