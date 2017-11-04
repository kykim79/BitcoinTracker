
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

let npad = (number) => (number < 1000000) ? pad(4, numeral((number)).format('0,0')) : pad(9, numeral((number)).format('0,0'));
let npercent = (number) => numeral(number * 100).format('0,0.00') + '%';
const CONFIG_FOLDER = './config/';
const CONFIG_FILE = '/trackerConfig.json';
const BITHUMB_URL = 'https://api.bithumb.com/public/recent_transactions/';
const WEBTOKEN = 'xoxp-146635173889-147997134374-263670048758-f86cb300f91c49ab741993f259d81459'; // for #cryptocurrency

// const CHANNEL_NAME = '#cryptocurrency';
const botId='xoxb-261765742902-L5maHrT9IVDOKJFXm159lxmg'; // for #cryptocurrency
const botName='satoshi_nakamoto';

const CHANNEL_NAME = '#cointest';

const  MATCH_REGEX = /^sa (?:([n]))|(?:([bxce])([n]))|(?:([bxce])([bsgh])([+-]?)((?:\d+.\d+)|(?:\d+))(k?))$/;
// MATCH_REGX contains all possible sub commands and parameters

// create a bot
let settings = {
    token: botId,
    name: botName
};

let bot = new Bot(settings);

const WELCOME_MESSAGE = '* Configration Bot Started *\n\n' +
    '*sa command syntax*\n\n' +
    '*sa* _{currency}{subcommand}{amount}_\n\n' +
    '     _{currency}_ b(BTC), x(XRP), e(ETH), c(BCH)\n' +
    '     _{subcommand}_ b | s | g | h | n\n' +
    '                    buy, sell, gap, histogram, now\n' +
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
    logger.debug('input text = ' + data.text);

    if (data.text.length < 4 || !data.text.startsWith('sa ')) {
        return;
    }

    let text = data.text.trim();

    try {
        // var channelName = channelIdToName(data.channel);
        // var userName = userIdToName(data.user);

        let match = MATCH_REGEX.exec(text);

        if (!match) {
            send('Invalid sa command syntax  : ' + text);
            return;
        }
        match.forEach((e, i) => console.log(i + ': ' + e));

        if (match[1]) { // sa n
            reply(coinTypes, 'Current Config');
        } else {  // sa bX
            if (match[2]) {
                if (match[3] === 'n') {
                    reply([coinType.get(match[2]).value], 'Config Now');
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
                reply([updateConfig(config)], 'New Config');
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
    case 's':
        cf.analyzer.sellPrice = updatePrice(c.sign, c.amount, cf.analyzer.sellPrice);
        cf.analyzer.histogram = roundTo((cf.analyzer.sellPrice + cf.analyzer.buyPrice) / 2 * cf.analyzer.histoPercent, 2);
        break;
    case 'b':
        cf.analyzer.buyPrice = updatePrice(c.sign, c.amount, cf.analyzer.buyPrice);
        cf.analyzer.histogram = roundTo((cf.analyzer.sellPrice + cf.analyzer.buyPrice) / 2 * cf.analyzer.histoPercent, 2);
        break;
    case 'g':
        cf.analyzer.gapAllowance = c.amount / 100;
        cf.analyzer.histogram = roundTo((cf.analyzer.sellPrice + cf.analyzer.buyPrice) / 2 * cf.analyzer.histoPercent, 2);
        break;
    case 'h':
        cf.analyzer.histoPercent = c.amount / 100;
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

function buildMessage(text, attachs = null) {
    let msg = {
        token: WEBTOKEN,
        channel: CHANNEL_NAME,
        as_user: false,
        username: 'CoinMonitor',
        text: text
    };
    if(attachs) {
        msg.attachments = JSON.stringify(attachs);
    }
    return msg;
}

function send(text) {
    requestMessage(buildMessage(text));
}

function sendWithAttach(text, attachs) {
    requestMessage(buildMessage(text, attachs));
}

function requestMessage(msg) {
    let webMsg = 'http://slack.com/api/chat.postMessage?' + querystring.stringify(msg);
    request(webMsg, function(error, response, body) {
        if (error || response.statusCode !== 200) {
            logger.error(error);
        }
    });
}

function reply(cointypes, msg) {
    console.log ('reply coins ' + cointypes);
    let request = (cointype) => new Promise((resolve, reject) => resolve(bhttp.get(BITHUMB_URL + cointype)));
    let response = (values) => values.map((value, i) => makeCoinConfig(cointypes[i], value));
    Promise.all(cointypes.map(e => request(e)))
        .then(response)
        .then(attachs => sendWithAttach(msg, attachs))
        .catch(e => logger.error(e));
}

function makeCoinConfig(cointype, value) {
    try {
        let cf = JSON.parse(fs.readFileSync(CONFIG_FOLDER + cointype.toLowerCase() + CONFIG_FILE)).analyzer;
        return new coinConfig(cointype)
            .addField('Buy   ', npad(cf.buyPrice))
            .addField('Histo(div) ', npercent(cf.histoPercent))
            .addField('Now ', npad(Number(value.body.data[0].price)))
            .addField('gapAllow ', npercent(cf.gapAllowance))
            .addField('Sell    ', npad(cf.sellPrice));
    } catch (e) {
        throw new Error('coinType:{0}, value:{1}'.format(coinType, value), e);
    }
}

// sa command syntax

// sa {currency}{subcommand}{amount}
//  {subcommand} b|s|g|h|n or {+|-}  buy, sell, gap, histogram, now  or  incremental Plus/Minus
//  {currency} b (BTC), x(XRP), e (ETH), c (BCH), ....
//  {amount} 1234567,  123.45, 6780k (k = 1000)

// example
// sa bs6800000   <- set BTC sellPrice to 6800000
// sa eb345k      <- set ETH buyPrice to 345000
// sa bb-1k       <- set BTC buyPrice down 1000
// sa xg0.012     <- set XRP gapAllowance to 0.012
// sa n           <- show all currency now status


