
// const ID = '51001232';    // 내 Push2me telegram bot용 id

/* * -----------------------------------

  매 TIME_GAP 분마다 bithumb에서 BTC 가격 정보를 가져온다
  이를 intervla queue에 보관하고, 지난 SHORT_QUESIZE 갯수만큼의 평균을 구한다
  이 값이 up down으로 바뀌면, trend queue에 쌓은 후
  trend queue에서 LONG_QUESIZE 갯수만큼의 평균도 구한다
  trend queue 내에서 TREND_DEPTH 만큼의 data로 변곡점여부를 판단하고
  telegram에 alert 한다

----------------------------------- * */

var bodyParser = require('body-parser');
var request = require('request');
var syncRequest = require('sync-request');
// var qs = require('querystring');
var dateFormat = require('dateformat');

var fs = require('fs');
var util = require("util");

var CoinInfo = require('./coinInfo');
var bu = require('./btc_util');

var fixedQueue = require('fixedqueue').FixedQueue;

const StringBuilder = require('string-builder');

// var event = require('event');
// var confirm = require('confirm-dialog');
// var clearlog = require('./clearlog');

//------------------------
// Trend array 내 min,max
var updown_str;
var trend_str;
var minTrend;
var maxTrend;
//------------------------

const BITHUMB_CURRENCY = 'BTC';
const BITHUMB_URL = "https://api.bithumb.com/public/ticker/" + BITHUMB_CURRENCY;

const TelegramBot = require('node-telegram-bot-api');

const TOKEN = '326940389:AAHfrcX3llp4_yY00QiQSKyRkfgK6jcFo-Y';  // @urBitCoinbot 
// const CHAT_ID = '51001232';                                    // @urBitCoinbot riopapa
const CHAT_ID = '-202744566';                                   // @urBitCoinbot group id

var bot = new TelegramBot(TOKEN, {polling: true});

const TIME_GAP = 1000 * 60 * 3;    // n 분 마다 자료 수집 (향후 10분정도로 설정이 적당해 보임))
const SHORT_QUEUE_SIZE = 6;  // n 개 전부터의 평균을 계산
const LONG_QUESIZE = 10;
const TREND_QUESIZE = 50;

// 지정된 갯수의 데이터가 유지되는 큐
// 새로운 데이터가 들어오면 오래된것부터 제거된다.
var SHORT_TBL = fixedQueue(SHORT_QUEUE_SIZE);             // 매 n 분마다 하나씩 queue에 쌓이는 곳
var LONG_TBL = fixedQueue(LONG_QUESIZE);          // up down이 발견될 때 마다 queue에 넣어두는 곳 분석 로직 제대로 안 됨
var TREND_TBL = fixedQueue(TREND_QUESIZE);          // history를 dump 하기 위한 que

const U_ARROW = '△' ;
const D_ARROW = '▽';

bu.fileToQueue('./log/Qshort.json', SHORT_TBL);
bu.fileToQueue('./log/Qlong.json', LONG_TBL);
bu.fileToQueue('./log/Qtrend.json', TREND_TBL);

alert2Telegram('Now on Monitoring @ ' + bu.datetimeString());

mainLoop();

setInterval(mainLoop,TIME_GAP);

function mainLoop () {
  
  try {
    var res = syncRequest('GET', BITHUMB_URL);
    // 빗썸으로 받아온 데이터를 기반으로 CoinInfo라는 객체를 생성한다.
    SHORT_TBL.push(new CoinInfo(getTickerBody(res))); // 일단 queue 에 넣는다
    var currTbl = SHORT_TBL[SHORT_TBL.length-1];
    calcShortTrendPrice();   // calculate tprice and updown
    appendToFile('./log/short.log',currTbl.toString());
    // fs.writeFile('./log/Qshort.json', JSON.stringify(shortTbl, null, 1) , 'utf-8'); // json으로 보관해 둠

    if (isShortChanged()) {
      currTbl = SHORT_TBL[SHORT_TBL.length-1];
      LONG_TBL.push(currTbl);

      calcLongTrendPrice();
      TREND_TBL.push(LONG_TBL[LONG_TBL.length-1]);
      // trendTbl = longTbl.slice();

      appendToFile('./log/long.log',LONG_TBL[LONG_TBL.length-1].toString());
      var analVal = analyzeLongChange();
      saveQueValues();
      if (analVal != null) {
        appendToFile('./log/watch.log',currTbl.toString()+","+analVal);
        alert2Telegram(buildTrendChart());
        alert2Telegram(buildAlertMsg(currTbl, analVal));
      }
    }
  } catch (exception) {
    console.error("[mainLoop] exception: " + exception);
  }
}

function saveQueValues() {
  // console.log('saving shortTbl :' + SHORT_TBL.length);
  // console.log('saving longTbl :' + LONG_TBL.length);
  // console.log('saving trendTbl :' + TREND_TBL.length);
  fs.writeFile('./log/Qshort.json', JSON.stringify(SHORT_TBL, null, 1) , 'utf-8');
  fs.writeFile('./log/Qlong.json', JSON.stringify(LONG_TBL, null, 1) , 'utf-8');
  fs.writeFile('./log/Qtrend.json', JSON.stringify(TREND_TBL, null, 1) , 'utf-8');
}

function getTickerBody(res) {
  var tickerBody;
  try {
    tickerBody = JSON.parse(res.getBody().toString("utf8"));
  } catch (exception) {
    console.error("[getTickerBody] Failed to parse bithumb ticker. " + exception);
    throw new Error("Exception: " + exception);
  }
  return tickerBody;
}

function dumpTable(tbl) {
  if (tbl.length <= 2) {
    return;
  }
  
  appendToFile('./log/dump.log','dumping .. '+ tbl.length);
  
  //tbl안에서 0번째부터 3개까지 접근
  tbl.slice(0,3).forEach( _ => appendToFile('./log/short.log', "\n > " + _.toString()) );
}

function calcShortTrendPrice() {   

// SHORT_QUESIZE 만큼 전부터의 평균값 계산 하여 intervalInfo[0].tprice 을 계산하고
// 바로전 tprice 대비로 updown 을 설정
  const CURR = SHORT_TBL.length - 1;
  if (CURR < SHORT_QUEUE_SIZE) {   // 좀 쌓였다싶어야 분석 시작
    SHORT_TBL[CURR].tprice = (SHORT_TBL[CURR].bprice+SHORT_TBL[CURR].sprice)/2;
    SHORT_TBL[CURR].updown = 's';    // s means short yet.
    return;
  }
  
  const LOOP_CNT = Math.min(CURR,SHORT_QUEUE_SIZE);
  var sum = 0;
  
  SHORT_TBL.slice().reverse().slice(0,LOOP_CNT-1).forEach(function(e) {
    sum += e.bprice + e.sprice;  
  });
  
  // 1000 원 단위로 재정리, 더 smooth하게 10000 단위?
  SHORT_TBL[CURR].tprice = parseInt ((sum / LOOP_CNT / 2) / 10,10) * 10;    

  // updown 설정
  if (SHORT_TBL[CURR].tprice > SHORT_TBL[CURR-1].tprice) {  // 바로 앞보다 up ? down ?
    SHORT_TBL[CURR].updown = 'u';
  } else if (SHORT_TBL[CURR].tprice < SHORT_TBL[CURR-2].tprice) {
    SHORT_TBL[CURR].updown = 'd';
  } else {
    SHORT_TBL[CURR].updown = SHORT_TBL[CURR-1].updown;
  }
  SHORT_TBL[CURR].trend = SHORT_TBL[CURR].updown;
}

function isShortChanged() {
  // 앞 record의 up/down 추세를 보고 약간 부드럽게 설정
  if (SHORT_TBL.length <= 3) {
    return false;
  }
  
  const CURR = SHORT_TBL.length - 1;
  if (SHORT_TBL[CURR].updown == SHORT_TBL[CURR-1].trend) {
    SHORT_TBL[CURR].trend = SHORT_TBL[CURR-1].trend;
    return false;
  }
  if (SHORT_TBL[CURR].updown == SHORT_TBL[CURR-2].trend) {
     SHORT_TBL[CURR].trend = SHORT_TBL[CURR-2].trend;
    return false;
  }
  SHORT_TBL[CURR].trend = SHORT_TBL[CURR].updown;
  return SHORT_TBL[CURR].trend != SHORT_TBL[CURR-1].trend;
}

function calcLongTrendPrice() {

// 바로전 tprice 대비로 updown 을 설정

  const CURR = LONG_TBL.length - 1;
  const LOOP_CNT = Math.min(CURR,LONG_QUESIZE);
  var sum = 0;

  LONG_TBL.slice().reverse().slice(0,LOOP_CNT).forEach( _ => sum += _.tprice );
    
  LONG_TBL[CURR].tprice = parseInt ((sum / LOOP_CNT) / 10,10) * 10;  

  // updown 설정
  if (CURR > 2) {
    if (LONG_TBL[CURR].tprice > LONG_TBL[CURR-1].tprice) {  // 바로 앞보다 up ? down ?
      LONG_TBL[CURR].trend = 'u';
    } else if (LONG_TBL[CURR].tprice < LONG_TBL[CURR-2].tprice) {
      LONG_TBL[CURR].trend = 'd';
    } else {
      LONG_TBL[CURR].trend = LONG_TBL[CURR-1].trend;
    }
  } else {
    LONG_TBL[CURR].trend = LONG_TBL[CURR].updown;
  }
}

function analyzeLongChange() {
  if (LONG_TBL.length < LONG_QUESIZE) {
    return null;
  }

  const CURR = LONG_TBL.length - 1;
  const LOOP_CNT = CURR;             // 이젠 que 전체가 대상임
  updown_str = '';
  trend_str = '';
  minTrend = 999999999;
  maxTrend = 0;
  
  var reverseLong = LONG_TBL.slice().reverse().slice(0,LOOP_CNT);
  
  reverseLong.filter( _ => _.tprice > maxTrend ).forEach( _ => maxTrend = _.tprice );
  reverseLong.filter( _ => _.tprice > maxTrend ).forEach( _ => maxTrend = _.tprice );
  reverseLong.filter( _ => _.tprice < minTrend ).forEach( _ => minTrend = _.tprice );
  
  LONG_TBL.slice(0,LOOP_CNT).forEach( _ => updown_str += _.updown ); // <- 이건 0 부터 n으로 합치고 싶은데...
  LONG_TBL.slice(0,LOOP_CNT).forEach( _ => trend_str += _.trend ); // <- 이건 0 부터 n으로 합치고 싶은데...
  
  // 현 가격이 그동안의 high, low 를 벗어 나면 alert
  if (LONG_TBL[CURR].tprice >= maxTrend) {
    return 'Max or Over';   
  }
  
  // 현 가격이 그동안의 high, low 를 벗어 나면 alert
  if (LONG_TBL[CURR].tprice <= minTrend) {
    return 'Min or Under';  
  }
  
  // 10% 범위 밖이면 alert
  if ((minTrend / maxTrend) < 0.97) {
    return 'Big lowHigh '+ (minTrend / maxTrend); 
  }
} 

function buildAlertMsg(ci, analVal) {
  var sb = new StringBuilder();
  sb.appendFormat('{0} \n', bu.datetimeString(ci.date));
  sb.append(ci.updown == 'u' ? U_ARROW : D_ARROW).append(ci.trend == 'u' ? U_ARROW.repeat(2) : D_ARROW.repeat(2)).appendLine();
  sb.appendFormat('(now):{0}\n', bu.numeralPad(ci.bprice));
  sb.appendFormat('  open:{0}\n', bu.numeralPad(ci.oprice));
  sb.appendFormat(' close:{0}\n', bu.numeralPad(ci.cprice));
  sb.appendFormat('   min:{0}\n', bu.numeralPad(ci.mprice));
  sb.appendFormat('   max:{0}\n', bu.numeralPad(ci.xprice));
  sb.appendFormat(' trend:{0}\n', bu.numeralPad(ci.tprice));
  sb.appendFormat('anal rslt:{0}\n', bu.numeralPad(ci.analVal));
  return sb.toString();
}

function buildTrendChart() {
    const CURR = LONG_TBL.length - 1;
    const LOOP_CNT = Math.min(CURR,TREND_QUESIZE);
    
    var maxbuy = maxTrend;
    
    var reversedLong = LONG_TBL.slice().reverse().slice(0,LOOP_CNT);
    
    reversedLong.forEach( _ => maxbuy = Math.max(maxbuy, _.tprice) );
    
    var minbuy = minTrend;
    
    reversedLong.forEach( _ => minbuy = Math.min(minbuy, _.tprice) );

    const DELTA = (maxbuy - minbuy) / 23;   // telegram에 쏠 수 있는 column max ?
    
    var sb = new StringBuilder();
    sb.append('chart')
    .appendLine('Tmin ').append(bu.numeralPad(minbuy))
    .appendLine('Tmax ').append(bu.numeralPad(maxbuy))
    .appendLine('delta ').append(bu.numeralPad(DELTA))
    .appendLine('updown ').append(updown_str).append()
    .appendLine('trend chart ').append(trend_str);
    var chartTxt = sb.toString();
                    
    reversedLong.forEach( _ => chartTxt += '\n' + '-'.repeat((_.tprice - minbuy) / DELTA) + _.trend );
    
    chartTxt += '\n' + bu.dateString(reversedLong[reversedLong.length-1].date) + " ~ " 
      + bu.dateString(reversedLong[0].date);
    return chartTxt;
}

function alert2Telegram(line){
  appendToFile('./log/telegram.log',"\n"+line);
  
  bot.sendMessage(CHAT_ID, util.format('```\n%s\n```', line),  {parse_mode: 'Markdown'}).timeout(15000).then(res => {
        util.log("[alert2Telegram] success: : ", line);
    }).catch(error => {
        util.log("[alert2Telegram] failed: %s, error: %s", line, error);
    });
}

function appendToFile(fname,line) {
  fs.appendFile(fname, line + '\n', (err) => {
    if (err) {
      console.error('[appendToFile] err: %s', err);
      throw err;
    }
  });
}
