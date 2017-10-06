# How to manage BitcoinTracker

## redis 
- crawler에서 crawl된 ticker 데이터가 저장되는 storage.
- celector에서 이곳에 저장된 데이터를 주기적으로 조회한다.

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

## StockChart
- csv파일을 읽어들여 차트를 렌더링한다. (stockcart/public/chart.js)
- chatChart 그리기 위해 계산된 값들 (..., MACD, signals,histogram) 을 Analyzer.js 에 넘겨 준다
- 렌더링된 차트는 웹 서비스로 제공되며 지정된 URL을 통해 차트를 확인할 수 있다.


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

## crawler.js
- bithumb 의 시세정보를 크롤링해서 Redis에 저장한다.

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

## tracker.js
- selector.js ohlcBuilder.js, candleFeeder.js, analyzer.js 등이 내부에서 수행된다.

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

### selector.js
- redis table을 시세 array 로 만들어 둔다

### ohlcBuilder.js
- selector 에서 넘겨준 array를 splitSize 단위로 나누어서 OHLC를 계산한 array를 만든다

### chartFeeder.js
- OHLC 결과를 chart로 그리기 위해 csv file을 만든다

### chart/src/chart.js
- csv file을 받아 MACDIndicator를 계산하고 rendering 한다
- 계산된 MACDIndicator를 analyzer로 넘겨 준다

### analyzer.js
- OHLC, MACD, sequence, histogram 등의 값을 이용해 buy,sell time을 포착한다
- 필요시 notifier를 통해 alert한다

### notifier.js
- analyzer의 작업 결과에 따라 slack에 message를 보내준다

### Minor Files

*_coinInfo.js_*
-  ohlcBuilder.js 에서 불려짐
- crawler.js에서 읽혀진 json에서 한 transaction object를 만듬

*_notiType.js_*
- notify type enum (info, warn, danger)

*_tradeType.js_*
- trade type enum (buy, sell)   // 안 쓰일 수도 있음

----
## Configuration Files
- file location: ./config

### redisConfig.json
- redis config
```js
{
  "host": "{redis remote URL}",
  "port": {port number}
}
```

### loggerConfig.json
- set target log where, how
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
      "filename": "./log/btc.log", 
      "maxLogSize": 200000
    }
  },
  "categories": {
    "default": { 
      "appenders": [ "file" ], 
      "level": "debug"
    }
  }      
}```

### crawlerConfig.json
- Crawler.js external parameters
```js
{
  "cron": "0-59/30 * * * * *",          //  얼마마다 data를 가져올지 
  "maxCount": 20000                     //  얼마나 많이 보관해 둘지  
}
```
### trackerConfig.json
- configuration that is used in selector.js, chartFeeder.js and analyzer.js 
```js
{
  "selector": {                         // Selector.js
    "cron": "5 0-59/4 * * * *"          // selector execution 주기
  },
  "ohlc": {                             // OHLC_Builder.js
    "splitSize": 16,                    // cron에서 생성한 data를 묶는 size
  },
  "chart": {                            // ChartFeeder.js
    "emaSize": 16                       // 아마 안 사용 될 듯 
  },
  "analyzer": {                         // Analyzer.js
    "buyPrice": 4350300,                // Target buy Price
    "sellPrice": 5074580,               // Target sell Price
    "gapAmount": 20000,                 // To be defined...
    "volumeHigh": 1300,
    "buyCount": 18,
    "sellCount": 7,
    "macdGap": 1245,
    "maxCount": 25
  }
}
```

