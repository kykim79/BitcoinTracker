
// require list //
require('dotenv').load();
const format = require('string-format');
format.extend(String.prototype);
const fs = require('fs');
const pad = require('pad');
const numeral = require('numeral');
const Bot = require('slackbots');
const Promise = require('bluebird');
const bhttp = require('bhttp');
const coinConfig = require('./coinConfig.js');
const coinType = require('./coinType.js');

const coinTypes = coinType.enums.map((c) => c.value);
const roundTo = require('round-to');
const npad = (number) => (number < 1000000) ? pad(5, numeral((number)).format('0,0')) : pad(9, numeral((number)).format('0,0'));
const npercent = (number) => numeral(number * 100).format('0,0.000') + '%';
const BITHUMB_URL = 'https://api.bithumb.com/public/recent_transactions/';

const replier = require('./replier.js');

// environment variables
const CONFIG = process.env.CONFIG;  // configuration folder with '/'
const CONFIG_FILENAME = '/trackerConfig.json';  // should start with '/'

// LOGGER
let log4js = require('log4js');
log4js.configure(CONFIG + 'loggerConfig.json');
let log4js_extend = require('log4js-extend');
log4js_extend(log4js, {
    path: __dirname,
    format: '(@name:@line:@column)'
});
const logger = log4js.getLogger('botmanager');

const CHANNEL = process.env.CHANNEL;
const USERS = process.env.USERS;

const BOT_NAME = process.env.BOT_NAME;
const BOT_TOKEN = process.env.BOT_TOKEN; // for #cryptocurrency & #cointest
const BOT_ICON = process.env.BOT_ICON;

const MATCH_REGEX = /^sb\s*(?:(?:([n]))|(?:([bxce])([n|a]))|(?:([bxce])([bsgh])\s*([+-]?)((?:\d+.\d+)|(?:\d+))(k?)))\s*$/i;

// create a bot
const settings = {
    token: BOT_TOKEN,
    name: BOT_NAME
};

const bot = new Bot(settings);

bot.on('start', function() {
    // more information about additional params https://api.slack.com/methods/chat.postMessage
    logger.debug('bot just started');
    showUsage();
});

function channelIdToName(id) {
    let channels = bot.getChannels();
    if (typeof channels !== 'undefined' && typeof channels._value !== 'undefined' && typeof channels._value.channels !== 'undefined') {
        channels = channels._value.channels;
        for (let i = 0; i < channels.length; i++) {
            if (channels[i].id === id) {
                return channels[i].name;
            }
        }
    }
    return '';
}

function userIdToName(id) {
    let users = bot.getUsers();
    if ((typeof users !== 'undefined') && (users._value !== 'undefined') && (users._value.members !== 'undefined')) {
        users = users._value.members;
        for (let i=0; i < users.length; i++ ) {
            if (users[i].id === id) {
                return users[i].name;
            }
        }
    }
    return '';
}

bot.on('message', function(data) {

    if (data.type !== 'message') {
        return;
    }

    const text = data.text.trim().toLowerCase();

    if (text) {
        logger.debug('command = [' + text + ']');
    }

    if (text.length < 2 || !text.startsWith('sb')) {
        return;
    }
    const channelName = '#' + channelIdToName(data.channel);
    if (channelName !== CHANNEL) {
        // send('Input fromm wrong channel[' + channelName + '], command ignored.');
        return;
    }
    const userName = userIdToName(data.user);
    if (USERS.indexOf(userName) === -1) {
        replier.sendText('You [' + userName + '] are not authorized user, command ignored.');
        return;
    }
    try {
        const match = MATCH_REGEX.exec(text);

        if (!match) {
            replier.sendText('Invalid slackbot command  [' + text + ']');
            return;
        }

        // match.forEach((e, i) => console.log(i + ': ' + e));

        if (match[0] === 'sb') {        // sb only
            showUsage();
        }
        else if (match[1] === 'n') {    // sb n
            showAllCoins();
        }
        else if (match[2]) {           // should be sb Xn  or sb Xa
            if (match[3] === 'n') {
                showOneCoin(coinType.get(match[2]).value, 'Current Configuration Values');
            }
            else if (match[3] === 'a') {
                adjustConfig(coinType.get(match[2]).value);
            }
            else {
                replier.sendText('Subcommand after coin should be "n" or "a"  : [' + text + ']'); // actually regex error
            }
        }
        else {
            const config = {
                cointype: coinType.get(match[4]).value,
                configField: match[5],
                sign: match[6],
                amount: match[8] === 'k' ? Number(match[7]) * 1000 : Number(match[7])
            };
            showOneCoin(updateConfig(config), 'New Configuration');
        }
    }
    catch (e) {
        logger.error(e);
    }
});

/**
 * updateConfig : update Configuration.json by commands input
 * @param c(command) {cointype(BTC), configField('b','s'), sign(+/-), amount(1234)
 * @returns {*}
 */

function updateConfig(c) {

    const configFile = CONFIG  + c.cointype.toLowerCase() + CONFIG_FILENAME;
    const cf = JSON.parse(fs.readFileSync(configFile));
    switch (c.configField) {
    case 's':   // sellPrice
        cf.sellPrice = updatePrice(c.sign, c.amount, cf.sellPrice);
        cf.histogram = roundTo((cf.sellPrice + cf.buyPrice) / 2 * cf.histoPercent, 2);
        break;
    case 'b':   // buyPrice
        cf.buyPrice = updatePrice(c.sign, c.amount, cf.buyPrice);
        cf.histogram = roundTo((cf.sellPrice + cf.buyPrice) / 2 * cf.histoPercent, 2);
        break;
    case 'g':   // gapAllowance
        cf.gapAllowance = roundTo(c.amount / 100,5);
        cf.histogram = roundTo((cf.sellPrice + cf.buyPrice) / 2 * cf.histoPercent, 2);
        break;
    case 'h':   // histogram
        cf.histoPercent = roundTo(c.amount / 100,5);
        cf.histogram = roundTo((cf.sellPrice + cf.buyPrice) / 2 * cf.histoPercent, 2);
        break;
    default:
        replier.sendText('undefined config field: ' + c.configField);   // should not happen
        process.exit(11);
    }
    fs.writeFileSync(configFile, JSON.stringify(cf, null, 1), 'utf-8');
    logger.debug('Update configration completed..');
    return c.cointype;
}

function updatePrice (sign, amount, price) {
    switch (sign) {
    case '+':
        price += amount;
        break;
    case '-':
        price -= amount;
        break;
    default:
        price = amount;
    }
    return price;
}
module.exports = updatePrice;

function showUsage() {
    const m = 'Monitor Cryptocurrency prices\n (Ver. 17-11-14)';
    replier.sendSlack(buildUsageMsg(),m);
    logger.debug(m);
}

function buildUsageMsg() {
    return '*Usage :*\n\n' +
        '*sb* _{currency}{subcommand}{amount}_\n\n' +
        '_{currency}_\n' +
        '   *b*:BTC, *x*:XRP, *e*:ETH, *c*:BCH, *n*:Now\n\n' +
        '_{subcommand}_\n' +
        '   *b*: buyPrice,           *s*: sellPrice\n' +
        '   *a*: adjust based on nowPrice\n' +
        '   *g*: gapAllowance,    *h*: histoPercent\n' +
        '   *n*: nowPrice\n\n' +
        '_{amount}_\n' +
        '   *1234000* : set to 1,234,000\n' +
        '   *1234k* : set to 12,340,000\n' +
        '   *+100* : add 100 to current set\n' +
        '   *-3k* : subtract 3000 from current set\n' +
        '   *1.03* : set to 1.03% (gap or histo only)\n\n' +
        '(note) Uppercase accepted, spaces allowed';
}

function showAllCoins() {
    const request = (cointype) => new Promise((resolve, reject) => resolve(bhttp.get(BITHUMB_URL + cointype)));
    const response = (values) => values.map((value, i) => makeCoinConfig(coinTypes[i], value));
    Promise.all(coinTypes.map(e => request(e)))
        .then(response)
        .then(attachs => replier.sendAttach(BOT_ICON, 'Current Configuration', attachs))
        .catch(e => logger.error(e));
}

function showOneCoin(cointype, msg) {
    // const request = (c) => new Promise((resolve, reject) => resolve(bhttp.get(BITHUMB_URL + c)));
    const response = (value) => showOneCoinType(cointype, value);
    Promise.try(() => bhttp.get(BITHUMB_URL +  cointype))
        .then(response)
        .then(attach => replier.sendAttach(cointype, msg, [attach]))
        .catch(e => logger.error(e));
}

function showOneCoinType(cointype, value) {
    return makeCoinConfig(cointype, value);
}

function adjustConfig(cointype) {
    // const request = (c) => new Promise((resolve, reject) => resolve(bhttp.get(BITHUMB_URL + c)));
    const response = (value) => adjustConfigSellBuy(cointype, value);
    Promise.try(() => bhttp.get(BITHUMB_URL +  cointype))
        .then(response)
        .then(attach => replier.sendAttach(cointype, 'Sell, Buy Price Adjusted', [attach]))
        .catch(e => logger.error(e));
}

function adjustConfigSellBuy(cointype, value) {
    try {
        const configFile = CONFIG + cointype.toLowerCase() + CONFIG_FILENAME;
        const cf = JSON.parse(fs.readFileSync(configFile));
        const n = Number(value.body.data[0].price);
        cf.buyPrice = roundTo(n * (1 - cf.gapAllowance * 3),0);
        cf.sellPrice = roundTo(n * (1 + cf.gapAllowance * 3),0);
        fs.writeFileSync(configFile, JSON.stringify(cf, null, 1), 'utf-8');
        return makeCoinConfig(cointype, value);
    }
    catch (e) {
        logger.error(e);
    }
}

function makeCoinConfig(cointype, value) {
    try {
        const cf = JSON.parse(fs.readFileSync(CONFIG + cointype.toLowerCase() + CONFIG_FILENAME));
        const nowPrice = Number(value.body.data[0].price);
        const volume = value.body.data.map(_ => Number(_.units_traded)).reduce((e1, e2) => e1 + e2);
        const blank = '       ';
        return new coinConfig(cointype)
            .addField('Buy:     ', npercent((nowPrice - cf.buyPrice ) / nowPrice), blank + npad(cf.buyPrice))
            .addField('gapAllow ', npercent(cf.gapAllowance), blank + npad(cf.gapAllowance * nowPrice))
            .addField('Now:', '',  blank + npad(nowPrice))
            .addField('histo(div) ', npercent(cf.histoPercent), blank + npad(cf.histoPercent * nowPrice))
            .addField('Sell:     ', npercent((cf.sellPrice - nowPrice) / nowPrice),  blank + npad(cf.sellPrice))
            .addField('volume ', '', blank + numeral(volume).format('0,0.000'))
        ;
    } catch (e) {
        // throw new Error('coinType:{0}, value:{1}'.format(coinType, value), e);
        throw new Error(e);
    }
}

