
// require list //
require('dotenv').load();
const format = require('string-format');
format.extend(String.prototype);
const fs = require('fs');

const Bot = require('slackbots');
const Promise = require('bluebird');
const bhttp = require('bhttp');

const show = require('./showStatus.js');
const replier = require('./replier.js');
const who = require('./getSlackName.js');

const roundTo = require('round-to');
const BITHUMB_URL = 'https://api.bithumb.com/public/recent_transactions/';

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

const COINS_KEY = process.env.COINS_KEY.split(',');
const COINS_CMD = process.env.COINS_CMD.split(',');
const coins_cmd = COINS_CMD.reduce((c1, c2) => c1 + c2);

const CHANNEL = process.env.CHANNEL;
const USERS = process.env.USERS.split(',');


const BOT_NAME = process.env.BOT_NAME;
const BOT_TOKEN = process.env.BOT_TOKEN; // for #cryptocurrency & #cointest

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

bot.on('message', function(data) {

    if (data.type !== 'message') {
        return;
    }

    const text = data.text.trim().toLowerCase();

    logger.debug('command = [' + text + ']');

    if (text.length < 2 || !text.startsWith('sb')) {
        return;
    }

    if ((who.channel(bot, data.channel)) !== CHANNEL || !USERS.includes(who.user(bot, data.user))) {
        replier.sendText('Unauthorized channel or user.');
        return;
    }

    try {
        const match = MATCH_REGEX.exec(text);

        if (!match) {
            replier.sendText('Invalid slackbot command  [' + text + ']');
            return;
        }
        logger.debug('regex matched');

        match.forEach((e, i) => logger.debug(i + ': ' + e));

        if (match[0] === 'sb') {        // sb only
            showUsage();
        }
        else if (match[1] === 'n') {    // sb n
            showAllCoins();
        }
        else if (match[2]) {           // should be sb Xn  or sb Xa
            if (match[3] === 'n') {
                show.info(COINS_KEY[COINS_CMD.indexOf(match[2])], 'Current Configuration Values');
            }
            else if (match[3] === 'a') {
                adjustConfig(COINS_KEY[COINS_CMD.indexOf(match[2])]);
            }
            else {
                replier.sendText('Subcommand after coin should be "n" or "a"  : [' + text + ']'); // actually regex error
            }
        }
        else {
            const config = {
                coin: COINS_KEY[COINS_CMD.indexOf(match[4])],
                command: match[5],
                sign: match[6],
                amount: match[8] === 'k' ? Number(match[7]) * 1000 : Number(match[7])
            };
            updateConfig(config);
            show.info(config.coin, 'New Configuration');
        }
    }
    catch (e) {
        logger.error(e);
    }
});

/**
 * updateConfig : update Configuration.json by commands input
 * @param c(command) {cointype(BTC), command('b','s'), sign(+/-), amount(1234)
 * @returns none
 */

function updateConfig(c) {

    const configFile = CONFIG  + c.coin.toLowerCase() + CONFIG_FILENAME;
    const cf = JSON.parse(fs.readFileSync(configFile));
    switch (c.command) {
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
        replier.sendText('undefined config field: ' + c.command);   // should not happen
        process.exit(11);
    }
    fs.writeFileSync(configFile, JSON.stringify(cf, null, 1), 'utf-8');
    logger.debug('Update configration completed..');
    // return c.cointype;
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
    const header =  'Monitor CrytoCoins _[' + process.env.COINS_KEY + ']_';
    const usage = '*USAGE*             _(Ver. 2017-11-19)_\n' +
        '*sb* _{currency}{subcommand}{amount}_\n' +
        '      {' + coins_cmd + 'n}  {bsaghn}  {(+/-)123(k)}\n' +
        '_Refer github_ README.md _for more detail_\nhttps://goo.gl/dkEUaR';    // => 'https://github.com/kykim79/BitcoinTracker'

    replier.sendSlack(usage, header, 'https://github.com/kykim79/BitcoinTracker');
    logger.debug(header);
}

function showAllCoins() {
    COINS_KEY.forEach(_ => show.info(_, 'Current Configuration'));
}

function adjustConfig(cointype) {
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
        return show.attach(cointype, value);
    }
    catch (e) {
        logger.error(e);
    }
}
