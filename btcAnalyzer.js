var format = require('string-format');
format.extend(String.prototype);

let pad = require('pad');
let numeral = require('numeral');
let roundTo = require('round-to');
var replaceall = require("replaceall");

// Stream Roller
var rollers = require('streamroller');
var stream = new rollers.RollingFileStream('./log/trend.log', 100000, 2);

// LOGGER
let log4js = require('log4js');
let logger = log4js.getLogger('analyzer');

// CONFIG
const ANALYZER = 'analyzer';
const ConfigWatch = require("config-watch");
const CONFIG_FILE = './config/trackerConfig.json';
let configWatch = new ConfigWatch(CONFIG_FILE);
let properties = configWatch.get(ANALYZER);

configWatch.on("change", (err, config) => {
    if (err) { throw err; }
    if(config.hasChanged(ANALYZER)) {
        properties = config.get(ANALYZER);
        logger.info('<New Target> buy {buy}, sell {sell}, volMax {volumeHigh}, cntMax {maxCount}'.format(properties));
    }
});

let npad = (number) => pad(9, numeral((number)).format('0,0'));

let alert = require('./btcNotifier.js');

let TradeStatus = require('./tradeStatus.js');

let TradeType = require('./tradeType.js');

let notiType = require('./notiType.js');

let isRestarted = true;

var emaBuilder = require('./btcEmaBuilder.js');
emaBuilder.getEmitter().on('event', listener);

function listener(args) { // args  [ ohlc , ema]
    if (args.length <= 4) {
        return;
    }
    
    try {
        analyzeTimeToTrade(args);
        saveConfig();
    } catch (exception) {
        logger.error(exception);
    }
}

// claculate timing thru ema, nowPrice, buy/sell
function analyzeTimeToTrade(priceInfos) {

    let ti = new TradeStatus(priceInfos, properties);
    
    if (isRestarted) {
        const startValue = {
            now : npad(ti.nowPrice), 
            changeLong : ti.changeLong,
            sell: npad(properties.sell),
            sellCount : properties.sellCount,
            buy: npad(properties.sell),
            buyCount : properties.buyCount,
            high : npad(ti.lastInfo.high),
            highGap : numeral(ti.lastInfo.high - ti.nowPrice).format('0,0'),
            ema : npad(ti.lastInfo.ema),
            emaGap : numeral(ti.emaGap).format('0,0'),
            volume: numeral(ti.volumeNow).format('0,0'),
            volHigh: (ti.isHighVolume) ? 'Hi':''
        };
        const startFormat = 'Now :{now}, chg:{changeLong}\n' +
                            'Sell:{sell}/{sellCount}\n' +
                            'Buy :{buy}/{buyCount},Vol:{volume} {volHigh}\n' +
                            'high:{high}, gap:{highGap}\n' +
                            'ema :{ema}, gap:{emaGap}';     // emaGap = nowPrice - ema
        alert.info(startFormat.format(startValue),'_Restarted_');

        isRestarted = false;
    }
    ti.msgText = '';

    let logMessage = '';
    logger.debug('ANALYZER ' + sortValues(ti));
    ti.msgText = '';
    analyzeSellTime(ti);
    logMessage += ti.msgText;
    ti.msgText = '';
    analyzeBuyTime(ti);
    logMessage += ti.msgText;
    keepLog(ti, replaceall('\n','; ',logMessage));
}

function sortValues(ti) {

    if (ti.isOverSell) {
        return '{2} sell({0.sell} / {0.sellCount}) <= NOW({1.nowPrice})'
        .format(properties, ti, '*'.repeat(properties.sellCount));
    }
    if (ti.isUnderBuy) {
        return 'NOW({0.nowPrice}) <= buy({1.buy} / {1.buyCount}) {2}'
        .format(ti, properties, '<'.repeat(properties.buyCount));
    }
    return 'buy({0.buy}/{0.buyCount}){2}<NOW({1.nowPrice}){3}<sell({0.sell}/{0.sellCount})'
    .format(properties, ti, 'v'.repeat(properties.sellCount), '^'.repeat(properties.buyCount)) ;
}

let sellHigh;
let sellPassed = false;

// ANALYZE    ===== S E L L =======

function analyzeSellTime(ti) {
    if (!properties.Want2Sell) {
        return;
    }

    if (ti.isnowEMAUp) {
        properties.sellCount++;
    } else {
        properties.sellCount--;
    }

    const sellValue = {
        now : npad(ti.nowPrice), 
        changeLong : ti.changeLong,
        sell: npad(properties.sell),
        sellCount : properties.sellCount,
        high : npad(ti.lastInfo.high),
        highGap : numeral(ti.lastInfo.high - ti.nowPrice).format('0,0'),
        ema : npad(ti.lastInfo.ema),
        emaGap : numeral(ti.emaGap).format('0,0'),
        volume: numeral(ti.volumeNow).format('0,0'),
        volHigh: ti.isHighVolume ? 'Hi' : ''
    };
    const sellFormat =  'Now :{now}, chg:{changeLong}\n' +
                        'Sell:{sell}/{sellCount},Vol:{volume} {volHigh}\n' +
                        'high:{high}, gap:{highGap}\n' +
                        'ema :{ema}, gap:{emaGap}';     // emaGap = nowPrice - ema

// 아래 조건문 두개는 아래쪽 ti.isOverSell 조건문 안쪽으로 들어가는게..
    if (ti.isOverSell && ti.isUUU && ti.isnowEMAUp && properties.sellCount > properties.maxCount) {
        properties.sell = roundTo(properties.sell * 1.005, -1);
        ti.msgText = 'Sell Adjusted *higher*';
        alert.warn(sellFormat.format(sellValue),ti.msgText);
        properties.sellCount -= 10;
        return;
    }

    if (ti.isOverSell && ti.isnowEMADn && ti.emaGap < properties.gapAmount) {
        ti.msgText = '*SELL SELL SELL*';
        alert.warn(sellFormat.format(sellValue),ti.msgText);
        return;
    }

//아래 두 조건문은 둘중에 반드시 하나만 발생함.
    if (ti.emaGap > 50000) {
        ti.msgText = '*Too Speedy Up/Down*';
        alert.info(sellFormat.format(sellValue),ti.msgText);
    }
    
    if (ti.emaGap < 3000 && Math.abs(ti.nowPrice - properties.Sell) < 50000) {
        ti.msgText = 'ema *NEAR* to now';
        alert.info(sellFormat.format(sellValue),ti.msgText);
    }
    
    if (ti.isOverSell) {
        properties.sellCount += 5;
        if (!sellPassed) {
            sellPassed = true;
            sellHigh = ti.lastInfo.high;
            ti.msgText = '*TargetSELL Passed*'; // nowPrice is just passing up target sell price
            logger.info(replaceall('\n', '; ',sellFormat.format(sellValue)) + ti.msgText);
        } else {
            alert.warn('now ({0.nowPrice}) GONE OVER SELL({1.sell})'.format(ti, properties));
        }
        
        if (ti.lastInfo.high > sellHigh) {
            sellHigh = ti.lastInfo.high;
            properties.sellCount += 3;
            logger.debug('set now {} to sellHigh'.format(sellHigh));
        } else if (ti.isnowEMADn) {
            ti.msgText = 'Sell Soon'; 
            alert.info(sellFormat.format(sellValue),ti.msgText);
        }
        
        if (ti.isnowEMADn && sellHigh > ti.nowPrice) {
            ti.msgText = '*< Sell Point >*';
            alert.warn(sellFormat.format(sellValue),ti.msgText);
            properties.sellCount -= 2;
        }
    } else {    // current < target.sell
        if (sellPassed && ti.isnowEMADn) {
            ti.msgText = '*Shoulder*';
            alert.danger(sellFormat.format(sellValue),ti.msgText);
            sellPassed = false;
        }
    }
}

let buyLow = 0;
let buyPassed = false;


// ANALYZE   ====== B U Y  =========

function analyzeBuyTime(ti) {
    if (!properties.Want2Buy) {
        return;
    }
    if (ti.isnowEMADn) {
        properties.buyCount++;
    } else {
        properties.buyCount--;
    }
    const buyValue = {
        now : npad(ti.nowPrice), 
        changeLong : ti.changeLong,
        buy: npad(properties.buy),
        buyCount : properties.buyCount,
        low: npad(ti.lastInfo.low),
        lowGap: numeral(ti.lastInfo.low - ti.nowPrice).format('0,0.0'),
        ema : npad(ti.lastInfo.ema),
        emaGap : numeral(ti.emaGap).format('0,0'),
        volume: numeral(ti.volumeNow).format('0,0'),
        volHigh: ti.isHighVolume ? 'Hi' : ''
    };
    const buyFormat =   'Now :{now}, chg:{changeLong}\n' +
                        'Buy :{buy}/{buyCount}, Vol:{volume}{volHigh}\n' +
                        'Low :{low}, gap:{lowGap}\n' +
                        'ema :{ema}, gap:{emaGap}';

    if (ti.isUnderBuy && ti.isDDD && ti.isnowEMADn && properties.buyCount > properties.maxCount) {
        properties.sell = roundTo(properties.buy * 0.995, -1);
        ti.msgText = 'Adjust *Buy lower*';
        alert.warn(buyFormat.format(buyValue),ti.msgText);
        properties.sellCount -= 10;
        return;
    }

    if (ti.isUnderBuy && ti.isnowEMAUp && Math.abs(ti.emaGap) > 1000  && (-ti.emaGap) < properties.gapAmount) {
        ti.msgText = '*BUY BUY BUY*';
        alert.danger(buyFormat.format(buyValue),ti.msgText);
        return;
    }
    
    if (ti.emaGap > 50000) {
        ti.msgText = '*Too Speedy Up/Down*';
        alert.info(buyFormat.format(buyValue),ti.msgText);
    }
    if (ti.emaGap < 3000  && Math.abs(ti.nowPrice - properties.Buy) < 50000) {
        ti.msgText = 'ema *NEAR* to now';
        alert.info(buyFormat.format(buyValue),ti.msgText);
    }

    if (ti.isUnderBuy) {
        if (!buyPassed) {
            buyPassed = true;
            buyLow = ti.lastInfo.low;
            logger.warn('now ({0.nowPrice}) is passing BUY({1.buy})'.format(ti, properties));
        }
        else {
            ti.msgText = 'Going *Down*';
            alert.danger(buyFormat.format(buyValue),ti.msgText);
        }
        if (ti.lastInfo.low < buyLow) {
            buyLow = ti.lastInfo.low;
            properties.buyCount += 2;
        } else {
            logger.debug('buyLow({0}) <= now({1.nowPrice})'.format(buyLow, ti)); 
        }
        if (ti.isnowEMAUp) {
            ti.msgText = '*BUY POINT*';
            alert.danger(buyFormat.format(buyValue),ti.msgText);
            return;
        }
    } else {
        if (buyPassed && ti.isnowEMAUp) {
            ti.msgText = 'is *Knee*';
            alert.danger(buyFormat.format(buyValue),ti.msgText);
            buyPassed = false;
        }
    }
}

function saveConfig() {
    if (properties.buyCount < 0) {
        properties.buyCount = 0;
    }
    if (properties.buyCount > properties.maxCount) {
        properties.buyCount = properties.maxCount;
    }
    if (properties.sellCount < 0) {
        properties.sellCount = 0;
    }
    if (properties.sellCount > properties.maxCount) {
        properties.sellCount = properties.maxCount;
    }
    configWatch.set(ANALYZER, properties);
    configWatch.save();
}

function keepLog(ti, tagInfo) {

    let str = [
        ti.lastInfo.date, 
        ti.lastInfo.open, 
        ti.lastInfo.high, 
        ti.lastInfo.low, 
        ti.lastInfo.close, 
        ti.nowPrice, 
        ti.lastInfo.ema,
        ti.changes,
        ti.changeLong,
        properties.buy, 
        properties.sell,
        roundTo(ti.lastInfo.volume,2), 
        tagInfo
    ].join(', ');
    
    stream.write(str + require('os').EOL);
}
