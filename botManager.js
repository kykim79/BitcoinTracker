
// require list //
var format = require('string-format');
format.extend(String.prototype);
const fs = require('fs');
let pad = require('pad');
let numeral = require('numeral');
let request = require('request');
var querystring = require('querystring');
var Bot = require('slackbots');
var Promise = require('bluebird');
var bhttp = require('bhttp');
var coinConfig = require('./coinConfig.js');
let coinType = require('./coinType.js');
let coinTypes = coinType.enums.map((c) => c.value);

// LOGGER
var log4js = require('log4js');
log4js.configure(process.env.LOGGER_CONFIG);
var log4js_extend = require('log4js-extend');
log4js_extend(log4js, {
  path: __dirname,
  format: '(@name:@line:@column)'
});
var logger = log4js.getLogger('botmanager');

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

const MATCH_REGEX = /^sa (?:(?:(\S))|(?:([bxce])([bsgh])([+-]?)((?:\d+.\d+)|(?:\d+))(k?)))$/;
// MATCH_REGX contains all possible sub commands and parameters

// create a bot
var settings = { 
  token: botId,
  name: botName
};

var bot = new Bot(settings);

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

  if (data.type != 'message') {
    return;
  }
  logger.debug('input text = ' + data.text);

  if (data.text.length < 4 || !data.text.startsWith('sa ')) {
    return;
  }

  var text = data.text.trim();

  try {
    // var channelName = channelIdToName(data.channel);
    // var userName = userIdToName(data.user);

    var match = MATCH_REGEX.exec(text);
    if (!match) {
      send('Invalid sa command syntax  : ' + text);
      return;
    }
    // match.forEach((e, i) => console.log(i + ': ' + e));

    if (match[1]) { // sa n
      reply(coinTypes, 'Current Config');
    }
    else {  // sa bs
      let config = {
        cointype: coinType.get(match[2]).value,
        configField: match[3],
        sign: match[4],
        amount: match[6] ? Number(match[5]) * 1000 : Number(match[5])
      };
      reply([updateConfig(config)], 'New Config');
    }
  }
  catch (e) {
    logger.error(e);
  }
});

function updateConfig(config) {

  let targetFile = CONFIG_FOLDER + config.cointype.toLowerCase() + CONFIG_FILE;
  let c = JSON.parse(fs.readFileSync(targetFile));
  switch (config.configField) {
  case 's':
    c.analyzer.sellPrice = updatePrice(config.sign, config.amount, c.analyzer.sellPrice);
    break;
  case 'b':
    c.analyzer.buyPrice = updatePrice(config.sign, config.amount, c.analyzer.buyPrice);
    break;
  case 'g':
    c.analyzer.gapAllowance = config.amount / 100;
    break;
  case 'h':
    c.analyzer.histoPercent = config.amount / 100;
    c.analyzer.histogram = (c.analyzer.sellPrice + c.analyzer.buyPrice) / 2 * c.analyzer.histoPercent;
    break;
  default:
    send('undefined config field: ' + config.configField);   // should not happen
    process.exit(1);
  }
  fs.writeFileSync(targetFile, JSON.stringify(c, null, 1), 'utf-8');
  return config.cointype;
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
    if (error || response.statusCode != 200) {
      logger.error(error);
    }
  });
}

function reply(cointypes, msg) {
  var request = (cointype) => new Promise((resolve, reject) => resolve(bhttp.get(BITHUMB_URL + cointype)));
  var response = (values) => values.map((value, i) => makeCoinConfig(cointypes[i], value));
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


