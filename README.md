# About BitcoinTracker
- This workspace is to find out right trading time for cryptocurrency
- cryptocurrency price source is [bithumb](https://www.bithumb.com)
- four modules are running
  - stock chart
  - redis database (redis cli)
  - bithumb price, volume crawler
  - tracker (selector > ohlcBuilder> analyzer)

## Table of Contents

- [Workspace Operation](#workspace-operation)
  - [redis db start/stop](#redis-operation)
  - [Stock Chart start/stop](#stockchart-operation)
  - [Crawler start/stop](#crawler-operation)
  - [Tracker start/stop](#tracker-operation)

- [Analyzing Files Explanation](#analyzing-files-explanation)
- [Configuration Files](#configuration-files)

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
- load and execute selector.js ohlcBuilder.js, candleFeeder.js, analyzer.js

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

# Configuration Files
- file location: ./config
- format : .json

## crawlerConfig.json
- Crawler.js external parameters
```js
{
  "currency" : "BTC",             //  target cryptocurrency to analyze            
  "priceRoundRadix": -3,          //  round up digit
  "cron": "0-59/15 * * * * *",    //  re crawl on every ...
  "maxCount": 10000               //  ignore old data if over this amount  
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
      "filename": "./log/btc.log",    // currendy dependency name
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
    "splitSize": 16                 //    chunk size to make one ohlc record
  },
  "analyzer": {                     // Analyzer.js
    "buyPrice": 4350300,            //    Target buy Price
    "sellPrice": 5074580,           //    Target sell Price
    "divergence": 1000              //    ignore analysis if sum of aFew histogram is so small
  }
}
```

## chart/public/currency.png
- currency icon used in chart url and slack
- BTC,ETH,XRP,ZEC coin icons are ready

