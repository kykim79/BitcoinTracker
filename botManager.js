
// require list //
let format = require('string-format');
format.extend(String.prototype);
const fs = require('fs');
let pad = require('pad');
let numeral = require('numeral');
let request = require('request');
let querystring = require('querystring');
let Bot = require('slackbots');
let Promise = require('bluebird');
let bhttp = require('bhttp');
let coinConfig = require('./coinConfig.js');
let coinType = require('./coinType.js');

let coinTypes = coinType.enums.map((c) => c.value);
let roundTo = require('round-to');

// LOGGER
let log4js = require('log4js');
log4js.configure(process.env.LOGGER_CONFIG);
let log4js_extend = require('log4js-extend');
log4js_extend(log4js, {
    path: __dirname,
    format: '(@name:@line:@column)'
});
let logger = log4js.getLogger('botmanager');

//

let npad = (number) => (number < 1000000) ? pad(5, numeral((number)).format('0,0')) : pad(9, numeral((number)).format('0,0'));
let npercent = (number) => numeral(number * 100).format('0,0.000') + '%';
const CONFIG_FOLDER = './config/';
const CONFIG_FILE = '/trackerConfig.json';
const BITHUMB_URL = 'https://api.bithumb.com/public/recent_transactions/';
const WEBTOKEN = 'xoxp-146635173889-147997134374-263670048758-f86cb300f91c49ab741993f259d81459'; // for #cryptocurrency
const ICON_URL = process.env.ICON_URL;

// const CHANNEL_NAME = '#cryptocurrency';
const botTOKEN='xoxb-261765742902-L5maHrT9IVDOKJFXm159lxmg'; // for #cryptocurrency
const botName='CoinMonitor';
// const botName='satoshi_nakamoto';

const CHANNEL_NAME = process.env.CHANNEL;

const  MATCH_REGEX = /^sa (?:([n]))|(?:([bxce])([n|a]))|(?:([bxce])([bsgh])([+-]?)((?:\d+.\d+)|(?:\d+))(k?))$/;
// MATCH_REGX contains all possible sub commands and parameters

// create a bot
let settings = {
    token: botTOKEN,
    name: botName
};

let bot = new Bot(settings);

const WELCOME_MESSAGE = '* Configuration Bot Started *\n\n' +
    '*sa command syntax*\n\n' +
    '*sa* _{currency}{subcommand}{amount}_\n\n' +
    '     _{currency}_ b(BTC), x(XRP), e(ETH), c(BCH)\n' +
    '     _{subcommand}_ b | s | g | h | n | a\n' +
    '             buy, sell, gap, histogram, now, adjust\n' +
    '             note) now, adjust has no {amount}\n' +
    '     _{amount}_ (+|-|)123.45k';

bot.on('start', function() {
    // more information about additional params https://api.slack.com/methods/chat.postMessage
    // var params = {
    //     icon_emoji: ':cat:'
    // };
    send(WELCOME_MESSAGE);
    logger.debug('bot just started');
});

bot.on('message', function(data) {

    if (data.type !== 'message') {
        return;
    }

    if (data.text.length < 4 || !data.text.startsWith('sa ')) {
        return;
    }

    logger.debug('command = [' + data.text + ']');
    let text = data.text.trim();

    try {
        // var channelName = channelIdToName(data.channel);
        // var userName = userIdToName(data.user);

        let match = MATCH_REGEX.exec(text);

        if (!match) {
            send('Invalid sa command syntax  : ' + text);
            return;
        }
        // match.forEach((e, i) => console.log(i + ': ' + e));

        if (match[1]) { // sa n
            showAllCoins(coinTypes, 'Current Config');
        } else {  // sa bX
            if (match[2]) {
                if (match[3] === 'n') {
                    showOneCoin(coinType.get(match[2]).value, 'Current Configuration Values');
                } else if (match[3] === 'a') {
                    adjustConfig(coinType.get(match[2]).value);
                } else {
                    send('Invalid sa subcommand  : ' + text);
                }
            } else {
                let config = {
                    cointype: coinType.get(match[4]).value,
                    configField: match[5],
                    sign: match[6],
                    amount: match[8] === 'k' ? Number(match[7]) * 1000 : Number(match[7])
                };
                showOneCoin(updateConfig(config), 'New Configuration');
            }
        }
    }
    catch (e) {
        logger.error(e);
    }
});

function updateConfig(c) {

    let targetFile = CONFIG_FOLDER + c.cointype.toLowerCase() + CONFIG_FILE;
    let cf = JSON.parse(fs.readFileSync(targetFile));
    switch (c.configField) {
    case 's':   // sellPrice
        cf.analyzer.sellPrice = updatePrice(c.sign, c.amount, cf.analyzer.sellPrice);
        cf.analyzer.histogram = roundTo((cf.analyzer.sellPrice + cf.analyzer.buyPrice) / 2 * cf.analyzer.histoPercent, 2);
        break;
    case 'b':   // buyPrice
        cf.analyzer.buyPrice = updatePrice(c.sign, c.amount, cf.analyzer.buyPrice);
        cf.analyzer.histogram = roundTo((cf.analyzer.sellPrice + cf.analyzer.buyPrice) / 2 * cf.analyzer.histoPercent, 2);
        break;
    case 'g':   // gapAllowance
        cf.analyzer.gapAllowance = roundTo(c.amount / 100,4);
        cf.analyzer.histogram = roundTo((cf.analyzer.sellPrice + cf.analyzer.buyPrice) / 2 * cf.analyzer.histoPercent, 2);
        break;
    case 'h':   // histogram
        cf.analyzer.histoPercent = roundTo(c.amount / 100,6);
        cf.analyzer.histogram = roundTo((cf.analyzer.sellPrice + cf.analyzer.buyPrice) / 2 * cf.analyzer.histoPercent, 2);
        break;
    default:
        send('undefined config field: ' + c.configField);   // should not happen
        process.exit(11);
    }
    fs.writeFileSync(targetFile, JSON.stringify(cf, null, 1), 'utf-8');
    return c.cointype;
}

function updatePrice(sign, amount, price) {
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

function buildMessage(coin, text, attachs = null) {
    let msg = {
        token: WEBTOKEN,
        channel: CHANNEL_NAME,
        as_user: false,
        username: botName,
        icon_url: ICON_URL + coin + '.png',
        text: text
    };
    if(attachs) {
        msg.attachments = JSON.stringify(attachs);
    }
    return msg;
}

function send(text) {
    requestMessage(buildMessage('BOT', text));
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

function showAllCoins(cointypes, msg) {
    let request = (cointype) => new Promise((resolve, reject) => resolve(bhttp.get(BITHUMB_URL + cointype)));
    let response = (values) => values.map((value, i) => makeCoinConfig(cointypes[i], value));
    Promise.all(cointypes.map(e => request(e)))
        .then(response)
        .then(attachs => sendWithAttach('BOT', msg, attachs))
        .catch(e => logger.error(e));
}

function showOneCoin(cointype, msg) {
    let request = (c) => new Promise((resolve, reject) => resolve(bhttp.get(BITHUMB_URL + c)));
    let response = (value) => showOneCoinType(cointype, value);
    Promise.try(() => {
        return bhttp.get(BITHUMB_URL +  cointype);
    })
        .then(response)
        .then(attach => sendWithAttach(cointype, msg, [attach]))
        .catch(e => logger.error(e));
}

function showOneCoinType(cointype, value) {
    return makeCoinConfig(cointype, value);
}

function adjustConfig(cointype) {
    let request = (c) => new Promise((resolve, reject) => resolve(bhttp.get(BITHUMB_URL + c)));
    let response = (value) => adjustSellBuy(cointype, value);
    Promise.try(() => {
        return bhttp.get(BITHUMB_URL +  cointype);
    })
        .then(response)
        .then(attach => sendWithAttach(cointype, 'Sell, Buy Price Adjusted', [attach]))
        .catch(e => logger.error(e));
}

function adjustSellBuy(cointype, value) {
    try {
        let targetFile = CONFIG_FOLDER + cointype.toLowerCase() + CONFIG_FILE;
        let cf = JSON.parse(fs.readFileSync(targetFile));
        let n = Number(value.body.data[0].price);
        cf.analyzer.buyPrice = roundTo(n * (1 - cf.analyzer.gapAllowance * 3),0);
        cf.analyzer.sellPrice = roundTo(n * (1 + cf.analyzer.gapAllowance * 3),0);
        fs.writeFileSync(CONFIG_FOLDER + cointype.toLowerCase() + CONFIG_FILE, JSON.stringify(cf, null, 1), 'utf-8');
        return makeCoinConfig(cointype, value);
    }
    catch (e) {
        logger.error(e);
    }
}

function makeCoinConfig(cointype, value) {
    try {
        let cf = JSON.parse(fs.readFileSync(CONFIG_FOLDER + cointype.toLowerCase() + CONFIG_FILE)).analyzer;
        return new coinConfig(cointype)
            .addField('Buy   ', npad(cf.buyPrice))
            .addField('Histo(div) ', npercent(cf.histoPercent))
            .addField('Now ', npad(Number(value.body.data[0].price)))
            .addField('gapAllow ', npercent(cf.gapAllowance))
            .addField('Sell     ', npad(cf.sellPrice));
    } catch (e) {
        // throw new Error('coinType:{0}, value:{1}'.format(coinType, value), e);
        throw new Error(e);
    }
}
