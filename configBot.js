
// require list //
var format = require('string-format');
format.extend(String.prototype);
const fs = require('fs');
let pad = require('pad');
let numeral = require('numeral');
let request = require('request');
var querystring = require('querystring');
var Bot = require('slackbots');
var Promise = require("bluebird");
var bhttp = require("bhttp");
var coinConfig = require('./coinConfig.js');
let coinType = require('./coinType.js');
let coinTypes = coinType.enums.map((c) => c.value); // should be coded in coinType.js

//

let npad = (number) => (number < 1000000) ? pad(4, numeral((number)).format('0,0')) : pad(9, numeral((number)).format('0,0'));
const CONFIG_FOLDER = './config/';
const CONFIG_FILE = '/trackerConfig.json';
const BITHUMB_URL = "https://api.bithumb.com/public/recent_transactions/";
const WEBTOKEN = "xoxp-146635173889-147997134374-263670048758-f86cb300f91c49ab741993f259d81459"; // for #cryptocurrency

// bot id name이 안 
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

function channelIdToName(id) {
    var channels = bot.getChannels();
    if ((typeof channels !== 'undefined')
        && (typeof channels._value !== 'undefined')
        && (typeof channels._value.channels !== 'undefined')) {
        channels = channels._value.channels;
        for (var i=0; i < channels.length; i++) {
                if (channels[i].id == id) {
                        // console.log('channel[' + i + '] = ' + channels[i]);
                        return channels[i].name;
                }   
        }   
    }   
    return ''; 
}
function userIdToName(id) {
    var users = bot.getUsers();
    // console.log('users:' + users);
    if ((typeof users !== 'undefined')
        && (users._value !== 'undefined')
        && (users._value.members !== 'undefined')) {
        users = users._value.members;
        for (var i=0; i < users.length; i++ ) { 
                if (users[i].id == id) {
                        return users[i].name;
                }   
        }   
    }   
    return ''; 
}

bot.on('start', function() {
    // more information about additional params https://api.slack.com/methods/chat.postMessage
    // var params = {
    //     icon_emoji: ':cat:'
    // };
    
});

bot.on('message', function(data) {
    if (data.type != 'message') {
        return;
    }

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
            reply(coinTypes, "Current Config");
        }
        else {  // sa bs
            let result = {
                coinType: coinType.get(match[2]).value,
                config: match[3],
                sign: match[4],
                amount: match[6] ? Number(match[5]) * 1000 : Number(match[5])
            };
            reply([updateConfig(result).coinType], "New Config");
        }
    }
    catch (e) {
        console.error(e);
    }
});

function updateConfig(val) {

    let targetFile = CONFIG_FOLDER + val.coin + CONFIG_FILE;
    let config = JSON.parse(fs.readFileSync(targetFile));
    switch (val.config) {
        case 's':
            config.analyzer.sellPrice = updatePrice(val, config.analyzer.sellPrice);
            break;
        case 'b':
            config.analyzer.buyPrice = updatePrice(val, config.analyzer.buyPrice);
            break;
        case 'g':
            config.analyzer.gapAllowance = val.amount / 100;
            break;
        case 'h':
            config.analyzer.histogram = val.amount;
            break;
        default:
            console.error('undefined config: ' + val.config);   // should not happen
    }
    fs.writeFileSync(targetFile, JSON.stringify(config, null, 1), 'utf-8');
    
    config.analyzer.coin = val.coin;
    return config.analyzer;
}

function updatePrice(val, price) {
    switch (val) {
        case '+':
            price += val.amount;
            break;
        case '-':
            price -= val.amount;
            break;
        default:
            price = val.amount;
    }
    return price;
}

function buildMessage(text, attachs = null) {
    let msg = {
        token: WEBTOKEN,
        channel: CHANNEL_NAME,
        as_user: false,
        username: "CoinMonitor",
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
            console.log(error);
        }
    });
}

function reply(COINS, msg) {
    var request = (coin) => new Promise((resolve, reject) => resolve(bhttp.get(BITHUMB_URL + coin)));
    var response = (values) => values.map((value, i) => makeCoinConfig(COINS[i], value));
    Promise.all(COINS.map(e => request(e)))
        .then(response)
        .then(attachs => sendWithAttach(msg, attachs))
        .catch(e => console.log(e));
}

function makeCoinConfig(coin, value) {
    let cf = JSON.parse(fs.readFileSync(CONFIG_FOLDER + coin + CONFIG_FILE)).analyzer;
    return new coinConfig(coin)
        .addField('Buy   ', npad(cf.buyPrice))
        .addField('Histo ', npad(cf.histogram))
        .addField('Now ', npad(Number(value.body.data[0].price))
        // .addField('gapAllow ', numeral(cf.gapAllowance * 100).format('0,0.0') + '%')
        // .addField('Sell    ', npad(cf.sellPrice)));
    );
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


