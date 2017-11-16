
// require list //
require('dotenv').load();
const format = require('string-format');
format.extend(String.prototype);
const fs = require('fs');
const pad = require('pad');
const numeral = require('numeral');
const request = require('request');
const querystring = require('querystring');
const Bot = require('slackbots');
const Promise = require('bluebird');
const bhttp = require('bhttp');
const coinConfig = require('./coinConfig');
const coinType = require('./coinType');
const EOL = require('os').EOL;

const CommandHelper = require('./commandHelper');

const coinTypes = coinType.enums.map((c) => c.value);
const roundTo = require('round-to');

const CONFIG = process.env.CONFIG;
const CONFIG_FILENAME = '/trackerConfig.json';

// LOGGER
let log4js = require('log4js');
log4js.configure(CONFIG + '/loggerConfig.json');
let log4js_extend = require('log4js-extend');
log4js_extend(log4js, {
    path: __dirname,
    format: '(@name:@line:@column)'
});
const logger = log4js.getLogger('botmanager');

const npad = (number) => (number < 1000000) ? pad(5, numeral((number)).format('0,0')) : pad(9, numeral((number)).format('0,0'));
const npercent = (number) => numeral(number * 100).format('0,0.000') + '%';
const BITHUMB_URL = 'https://api.bithumb.com/public/recent_transactions/';
const WEB_TOKEN = process.env.WEB_TOKEN;
const ICON_URL = process.env.ICON_URL;
const WEB_HOOK = process.env.WEB_HOOK;

// const CHANNEL_NAME = '#cryptocurrency';
const BOT_TOKEN = process.env.BOT_TOKEN; // for #cryptocurrency & #cointest
const BOT_NAME = 'CoinMonitor';
const BOT_ICON = 'BOT';
let slackPost = require('slackpost');
let post = slackPost.post(WEB_HOOK);
post.setUsername(BOT_NAME).enableFieldMarkdown();


const CHANNEL = process.env.CHANNEL;
const USERS = process.env.USERS;
const CHART_URL = process.env.CHART_URL;

let showUsage = () =>  sendToSlack(buildUsageMsg(),'Monitor Cryptocurrency prices\n (Ver. 17-11-14)');

let showAllCoins = (match, [cointypes, msg]) => {
    const request = (cointype) => new Promise((resolve, reject) => resolve(bhttp.get(BITHUMB_URL + cointype)));
    const response = (values) => values.map((value, i) => makeCoinConfig(cointypes[i], value));
    Promise.all(cointypes.map(e => request(e)))
        .then(response)
        .then(attachs => sendWithAttach(BOT_ICON, msg, attachs))
        .catch(e => logger.error(e));
};

let updateCoin = (match, [msg]) => {
    updateConfig(match);
    showCoin(match, msg);
};

let showCurrCoin = (match, [msg]) => showCoin(match, msg);

let showCoin = (match, msg) => {
    const ct = coinType.get(match[1]).value;
    const response = (value) => showCoinType(ct, value);
    Promise.try(() => bhttp.get(BITHUMB_URL +  ct))
        .then(response)
        .then(attach => sendWithAttach(ct, msg, [attach]))
        .catch(e => logger.error(e));
};

let adjustConfig = (match, msg) => {
    const ct = coinType.get(match[1]).value;
    const request = (c) => new Promise((resolve, reject) => resolve(bhttp.get(BITHUMB_URL + c)));
    const response = (value) => adjustSellBuy(ct, value);
    Promise.try(() => bhttp.get(BITHUMB_URL +  ct))
        .then(response)
        .then(attach => sendWithAttach(ct, 'Sell, Buy Price Adjusted', [attach]))
        .catch(e => logger.error(e));
};

let updateConfig = (match) => {
    const c = {
        cointype: coinType.get(match[1]).value,
        configField: match[2],
        sign: match[3],
        amount: match[5] === 'k' ? Number(match[4]) * 1000 : Number(match[4])
    };

    const configFile = CONFIG + '/' + c.cointype.toLowerCase() + CONFIG_FILENAME;
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
        cf.gapAllowance = roundTo(c.amount / 100, 4);
        cf.histogram = roundTo((cf.sellPrice + cf.buyPrice) / 2 * cf.histoPercent, 2);
        break;
    case 'h':   // histogram
        cf.histoPercent = roundTo(c.amount / 100, 6);
        cf.histogram = roundTo((cf.sellPrice + cf.buyPrice) / 2 * cf.histoPercent, 2);
        break;
    default:
        send('undefined config field: ' + c.configField);   // should not happen
        process.exit(11);
    }
    fs.writeFileSync(configFile, JSON.stringify(cf, null, 1), 'utf-8');
};

const MATCH_REGEX = /^sb\s*(?:(?:([n]))|(?:([bxce])([na]))|(?:([bxce])([bsgh])\s*([+-]?)((?:\d+.\d+)|(?:\d+))(k?)))?\s*$/i;

const commandHelper = new CommandHelper()
    .addCommand(/^sb\s*$/, showUsage)
    .addCommand(/^sb\s*n$/, showAllCoins, [coinTypes, 'Current Config'])
    .addCommand(/^sb\s*([bxce])n$/, showCurrCoin, ['Current Configuration Values'])
    .addCommand(/^sb\s*([bxce])a$/, adjustConfig, [])
    .addCommand(/^sb\s*([bxce])([bsgh])\s*([+-]?)((?:\d+.\d+)|(?:\d+))(k?)$/, updateCoin, ['New Configuration']);

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
    return (channels && channels._value && channels._value.channels)
        ? '#' + channels._value.channels.find(e => e.id === id).name
        : '';
}

function userIdToName(id) {
    let users = bot.getUsers();
    return (users && users._value && users._value.members)
        ? users._value.members.find(e => e.id === id).name
        : '';
}

bot.on('message', function(data) {

    if (data.type !== 'message') {
        return;
    }

    const text = data.text.trim().toLowerCase();

    if (text.length < 2 || !text.startsWith('sb')) {
        return;
    }
    logger.debug('command = [' + text + ']');

    if ((channelIdToName(data.channel)) !== CHANNEL || !USERS.includes(userIdToName(data.user))) {
        send('Unauthorized channel or user.');
        return;
    }

    try {
        commandHelper.execute(text);
    }
    catch (e) {
        logger.error(e);
    }
});

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

function buildMessage(iconName, text, attachs = null) {
    const msg = {
        token: WEB_TOKEN,
        channel: CHANNEL,
        as_user: false,
        username: BOT_NAME,
        icon_url: ICON_URL + iconName + '.png',
        text: text
    };
    if(attachs) {
        msg.attachments = JSON.stringify(attachs);
    }
    return msg;
}

function send(text) {
    requestMessage(buildMessage(BOT_ICON, text));
}

function sendWithAttach(coin, text, attachs) {
    requestMessage(buildMessage(coin, text, attachs));
}

function requestMessage(msg) {
    let webMsg = 'http://slack.com/api/chat.postMessage?' + querystring.stringify(msg);
    request(webMsg, function(error, response, body) {
        if (error || response.statusCode !== 200) {
            logger.error(error);
        }
    });
}

function buildUsageMsg() {
    return '*Usage :*\n' +
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

function showCoinType(cointype, value) {
    return makeCoinConfig(cointype, value);
}

function adjustSellBuy(cointype, value) {
    try {
        const configFile = CONFIG + '/' + cointype.toLowerCase() + CONFIG_FILENAME;
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
        const cf = JSON.parse(fs.readFileSync(CONFIG + '/' + cointype.toLowerCase() + CONFIG_FILENAME));
        return new coinConfig(cointype)
            .addField('Buy   ', npad(cf.buyPrice))
            .addField('histo(div) ', npercent(cf.histoPercent))
            .addField('Now ', npad(Number(value.body.data[0].price)))
            .addField('gapAllow ', npercent(cf.gapAllowance))
            .addField('Sell     ', npad(cf.sellPrice));
    } catch (e) {
        // throw new Error('coinType:{0}, value:{1}'.format(coinType, value), e);
        throw new Error(e);
    }
}

function sendToSlack(line, title) {
    try {
        post
            .setColor(0)
            .setTitle(title,CHART_URL)
            .setRichText(line,true)
            .setIconURL(ICON_URL + BOT_ICON + '.png')
            .enableUnfurlLinks()
            .send((err) => { if (err) throw err; });
    } catch(e) {
        logger.error(e);
    }
}
