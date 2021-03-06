[![Waffle.io - Columns and their card count](https://badge.waffle.io/kykim79/BitcoinTracker.svg?columns=all)](http://waffle.io/kykim79/BitcoinTracker) [![Build Status](https://semaphoreci.com/api/v1/kykim79/bitcointracker/branches/master/shields_badge.svg)](https://semaphoreci.com/kykim79/bitcointracker)

# About BitcoinTracker
- This workspace is to find out right trading time for cryptocurrency
- cryptocurrency price source is [bithumb](https://www.bithumb.com)
- four modules are running
  - stock chart
  - redis database (redis cli)
  - bithumb price, volume crawler
  - tracker (selector > ohlcBuilder> analyzer)
  - botManager (to change configuration via slack)

## Table of Contents

- [Workspace Operation](#workspace-operation)
  - [redis db start/stop](#redis-operation)
  - [Stock Chart start/stop](#stockchart-operation)
  - [Crawler start/stop](#crawler-operation)
  - [Tracker start/stop](#tracker-operation)
  - [botManager start/stop] <- to be documented later

- [Analyzing Files Explanation](#analyzing-files-explanation)
- [Configuration Files](#configuration-and-environment-files)
- [Usage at Slack](#usage)

# Workspace Operation

## redis operation
- memory database cotains crawled cryptocurrency information by crawler.js
- selector.js will access this database peridically

### start
```
/etc/init.d/redis-server start
```

### stop
```
/etc/init.d/redis-server stop
```

### restart
```
/etc/init.d/redis-server restart
```

----

## StockChart Operation
- render chart from csv file (chart/public/chart.js) to ide.c9.io url

### start
```
cd ~/workspace/chart/
npm start &
```

### stop
```
ps -ef | grep stockchart
ubuntu     10112   10111  0 13:25 pts/9    00:00:00 node /home/ubuntu/workspace/stockchart/node_modules/.bin/react-scripts start
ubuntu     10118   10112  4 13:25 pts/9    00:00:16 node /home/ubuntu/workspace/stockchart/node_modules/react-scripts/scripts/start.js
ubuntu     10128   10118  0 13:25 pts/9    00:00:00 /bin/sh /home/ubuntu/workspace/stockchart/node_modules/opn/xdg-open http://localhost:8080/
ubuntu     10293    8121  0 13:32 pts/11   00:00:00 grep --color=auto stoc
# kill -9 10112
# kill -9 10118
# kill -9 10128
```
----

## Crawler Operation
- crawl cryptocurrency by using bithumb API
- save into redis database located in redisConfig.json by the coinInfo.js object form.

### start
```
cd ~/workspace
node crawler.js &
```

### stop
```
ps -ef | grep crawler
ubuntu      9114    7659  0 13:07 pts/9    00:00:01 node ./crawler.js
ubuntu     10337    8121  0 13:36 pts/11   00:00:00 grep --color=auto crawler
kill -9 9114
```
----

## Tracker Operation
- load and execute selector.js ohlcBuilder.js, chartFeeder.js, analyzer.js

### start
```
cd ~/workspace
node tracker.js &
```
### stop
```
ps -ef | grep tracker
ubuntu      9340    7659  0 13:08 pts/9    00:00:01 node tracker.js
ubuntu     10353    8121  0 13:39 pts/11   00:00:00 grep --color=auto tracker
kill -9 9340
```

----

## BotManager Operation
- load and execute botManager.js

### start
```
cd ~/workspace
node botManager.js &
```
### stop
```
ps -ef | grep botManager
ubuntu      9340    7659  0 13:08 pts/9    00:00:01 node botManager.js
ubuntu     10353    8121  0 13:39 pts/11   00:00:00 grep --color=auto tracker
kill -9 9340
```

## Analyzing Files Explanation

### selector.js
- read cryptocurrency data peridically

### ohlcBuilder.js
- calculate OHLC by chunking array pushed by selector.js

### chartFeeder.js
- feed OHLC data in csv format to /chart/chart.js

### chart/src/chart.js
- invoked by updating chart/public/CandleData.csv
- render stock candle and MACD chart to ide.c9.io screen

### analyzer.js
- calculate MACD, signal, histogram
- analyze buy,sell time using histogram (= divergence) 
- inform thru notifier.js whether to buy,sell

### notifier.js
- send various message to slack bia webhook

### Minor Files

#### coinInfo.js
- create one by one transaction provided by crawler.js

#### notiType.js
- notify type enum (info, warn, danger)

#### tradeType.js
- trade type enum (buy, sell)

----

# Configuration and Environment Files

## crawler

- ./crawler.env

```
REDIS_HOST=locahost
REDIS_PORT=6379
MAX_COUNT=1000
CONFIG=./config/
LOG=./log/
LOGGER_CONFIGFILE=loggerConfig.json
LOGGER_OUTFILE=coinhistory.log
```

## crawlerConfig.json
- Crawler.js external parameters
```js
{
  "currency" : "BTC",             //  target cryptocurrency to analyze            
  "priceRoundRadix": -3,          //  round up digit
  "cron": "0-59/15 * * * * *",    //  re crawl on every ...
  "maxCount": 1000                //  ignore old data if over this amount  
}
```

## loggerConfig.json
- set log target to which file
```js
{
  "replaceConsole": true,
  "appenders": {
    "console": { 
      "type": "console",
      "layout": {
        "type": "pattern",
        "pattern": "%[[%r] [%5.5p] %c -%] %m%n"
      }
    },
    "file": { 
      "type": "file", 
      "filename": "./log/coin.log",
      "maxLogSize": 200000
    }
  },
  "categories": {
    "default": { 
      "appenders": [ "file" ], 
      "level": "debug"
    }
  }      
}
```

## notifyConfig.json
- contains slack webHook channel information and c9 chart url
```js
{
	"webHook": {slack notify target channel},
	"chart": {stock chart html url}
}

```

## redisConfig.json
- redis remote db location

```js
{
  "host": "{redis remote URL}",
  "port": {port number}
}
```

## trackerConfig.json
- configuration that is used in selector.js, chartFeeder.js and analyzer.js 
```js
{
  "currency" : "BTC",               // target cryptocurrency (should be paired with crawlerConfig.json currency)
  "selector": {                     // Selector.js
    "cron": "5 0-59/4 * * * *"      //    rerun selector.js on every ..
  },
  "ohlc": {                         // ohlcBuilder.js
    "splitSize": 4                  //    chunk size to make one ohlc record (usually same with cron rerun min.)
  },
  "analyzer": {                     // Analyzer.js
    "gapAllowance": 0.033,          //    gap allowance to check within target sell,buy price for warning
    "buyPrice": 4350300,            //    Target buy Price
    "sellPrice": 5074580,           //    Target sell Price
    "divergence": 1000              //    ignore analysis if sum of aFew histogram is so small
  }
}
```

## chart/public/currency.png
- currency icon used in chart url and slack
- BTC,ETH,XRP,ZEC, BCH coin icons are ready


# Usage

## sb _{currency}{subcommand}{amount}_

### _{currency}_

-   *b*:BTC, *x*:XRP, *e*:ETH, *c*:BCH, *g*BTG, .. (as you defiend)
-   *n*:Now
   
### _{subcommand}_

-   *b*: buyPrice,           *s*: sellPrice
-   *g*: gapAllowance
-   *a*: adjust buy,sell based on nowPrice +/- gapAllowance * 3 %
-   *n*: nowPrice
   
### _{amount}_

-   *1234000* : set to 1,234,000
-   *12340k* : set to 12,340,000
-   *+100* : add 100 to current set
-   *-3k* : subtract 3000 from current set
-   *+3%* : add 3% on current set
-   *0.03* : set to 0.03% (gap only)

### _(note)_
 
- Uppercase currency accepted
- Spaces between _currency_, _subcommand_ and _amount_ are allowed
  
