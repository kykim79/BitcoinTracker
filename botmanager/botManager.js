
// require list //
require('dotenv').load();

const format = require('string-format');
format.extend(String.prototype);
const fs = require('fs');

const Bot = require('slackbots');
const Promise = require('bluebird');
const bhttp = require('bhttp');

const CommandHelper = require('./commandHelper');

const show = require('./showStatus.js');
const replier = require('./replier.js');
const who = require('./getSlackName.js');
const roundTo = require('round-to');
const BITHUMB_URL = 'https://api.bithumb.com/public/recent_transactions/';

// CONFIGRATION && LOGGER
const CONFIG = process.env.CONFIG;  // configuration folder with '/'
const CONFIG_FILENAME = process.env.CONFIG_FILENAME;

const json = require('json-file');
let log4js = require('log4js');
const LOG = process.env.LOG;
const LOGGER_CONFIGFILE = process.env.LOGGER_CONFIGFILE;
const LOGGER_OUTFILE = process.env.LOGGER_OUTFILE;
let logCf = new json.read(CONFIG + LOGGER_CONFIGFILE).data;
logCf.appenders.file.filename = LOG + 'botmanager/' + LOGGER_OUTFILE;
log4js.configure(logCf);
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

function showUsage() {
    const header =  'Monitor CrytoCoins _[' + process.env.COINS_KEY + ']_';
    const usage = '*USAGE*             _(Ver. 2017-11-25)_\n' +
        '*sb* _{currency}{subcommand}{amount}_\n' +
        '      {' + coins_cmd + 'n}  {bsaghn}  {(+/-)123(k%)}\n' +
        '_Refer github_ README.md _for more detail_\nhttps://goo.gl/dkEUaR';    // => 'https://github.com/kykim79/BitcoinTracker'

    replier.sendSlack(usage, header, 'https://github.com/kykim79/BitcoinTracker');
    logger.debug(header);
}

let showAllCoins = (match, params) => COINS_KEY.forEach(_ => show.info(_, params[0]));

let updateCoin = (match, params) => {
    updateConfig(match);
    showCoin(match, params);
};

let showCoin = (match, params) => show.info(COINS_KEY[COINS_CMD.indexOf(match[1])], params[0]);

let adjustConfig = (match, params) => {
    const cointype = COINS_KEY[COINS_CMD.indexOf(match[1])];
    const response = (value) => adjustSellBuy(cointype, value);
    Promise.try(() => bhttp.get(BITHUMB_URL +  cointype))
        .then(response)
        .then(attach => replier.sendAttach(cointype, params[0], [attach]))
        .catch(e => logger.error(e));
};

/**
 * updateConfig : update Configuration.json by commands input
 * @param match : match : [c(command) {cointype(BTC), command('b','s'), sign(+/-), amount(1234)]
 * @returns none
 */
let updateConfig = (match) => {
    const c = {
        coin: COINS_KEY[COINS_CMD.indexOf(match[1])],
        command: match[2],
        sign: match[3],
        amount: match[4],
        percentKilo: match[5]
    };

    const configFile = CONFIG + c.coin.toLowerCase() + '/' + CONFIG_FILENAME;
    const cf = JSON.parse(fs.readFileSync(configFile));
    switch (c.command) {
    case 's':   // sellPrice
        cf.sellPrice = updatePrice(c.sign, c.amount, cf.sellPrice, c.percentKilo);
        cf.histogram = roundTo((cf.sellPrice + cf.buyPrice) / 2 * cf.histoPercent, 2);
        break;
    case 'b':   // buyPrice
        cf.buyPrice = updatePrice(c.sign, c.amount, cf.buyPrice, c.percentKilo);
        cf.histogram = roundTo((cf.sellPrice + cf.buyPrice) / 2 * cf.histoPercent, 2);
        break;
    case 'g':   // gapAllowance
        cf.gapAllowance = roundTo(c.amount / 100, 5);
        cf.histogram = roundTo((cf.sellPrice + cf.buyPrice) / 2 * cf.histoPercent, 2);
        break;
    case 'h':   // histogram
        cf.histoPercent = roundTo(c.amount / 100, 5);
        cf.histogram = roundTo((cf.sellPrice + cf.buyPrice) / 2 * cf.histoPercent, 2);
        break;
    default:
        replier.sendText('undefined config field: ' + c.command);   // should not happen
        process.exit(11);
    }
    fs.writeFileSync(configFile, JSON.stringify(cf, null, 1), 'utf-8');
    logger.debug('Update configration completed..');
};

const commandHelper = new CommandHelper()
    .addCommand(/^sb\s*$/, showUsage)
    .addCommand(/^sb\s*n$/, showAllCoins, ['Current Config'])
    .addCommand(/^sb\s*([bxce])n$/, showCoin, ['Current Configuration Values'])
    .addCommand(/^sb\s*([bxce])a$/, adjustConfig, ['Sell, Buy Price Adjusted'])
    .addCommand(/^sb\s*([bxce])([bsgh])\s*([+-]?)((?:\d+.\d+)|(?:\d+))([k%]?)$/, updateCoin, ['New Configuration']);

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

    logger.debug('data.type is ' + data.type);

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
        commandHelper.execute(text);
    }
    catch (e) {
        logger.error(e);
    }
});

function updatePrice (sign, amount, price, percentKilo) {
    switch (sign + percentKilo) {    // sign : [+|-|], pK : [k|%|]
    case '+':
        price += amount;
        break;
    case '-':
        price -= amount;
        break;
    case '+k':
        price += amount * 1000;
        break;
    case '-k':
        price -= amount * 1000;
        break;
    case '+%':
        price += price * (amount /100);
        break;
    case '-%':
        price -= price * (amount /100);
        break;
    case 'k':
        price = amount * 1000;
        break;
    case '%':
        price = price * amount / 100;
        break;
    default:
        price = amount;
    }
    return roundTo(price,0);
}

function adjustSellBuy(cointype, value) {
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
