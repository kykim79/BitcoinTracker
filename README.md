# How to manage BitcoinTracker

## redis 
- btcCrawler에서 crawl된 ticker 데이터가 저장되는 storage.
- btcSelector에서 이곳에 저장된 데이터를 주기적으로 조회한다.

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
- csv파일을 읽어들여 차트를 렌더링한다.
- 렌더링된 차트는 웹 서비스로 제공되며 지정된 URL을 통해 차트를 확인할 수 있다.

### start
```
cd ~/workspace/stockchart/
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

## btcCrawler.js
- bithumb 의 시세정보를 크롤링해서 Redis에 저장한다.

### start
```
cd ~/workspace
node btcCrawler.js &
```

### stop
```
ps -ef | grep Crawler
ubuntu      9114    7659  0 13:07 pts/9    00:00:01 node ./btcCrawler.js
ubuntu     10337    8121  0 13:36 pts/11   00:00:00 grep --color=auto Crawler
kill -9 9114
```
----

## btcTracker.js
- btcSelector.js btcOhlcBuilder.js, btcEmaBuilder.js, btcAnalyzer.js 등이 내부에서 수행된다.

### start
```
cd ~/workspace
node btcTracker.js &
```
### stop
```
ps -ef | grep Tracker
ubuntu      9340    7659  0 13:08 pts/9    00:00:01 node btcTracker.js
ubuntu     10353    8121  0 13:39 pts/11   00:00:00 grep --color=auto Tracker
kill -9 9340
```

----

## btcConfig.json
- bitcoin을 mointoring하기 위한 변수들 모음.
- btcCrawler.js, btcOhlcBuilder.js, btcEmaBuilder.js, btcAnalyzer.js 의 수행시 외부 변수로 설정된다.

### json에 포함된 내용들#


----

## Crawler.js
- Crawling from bithumb ('BTC', ..) into redis source db at every 30 secs
 

## Tracker.js
- Selector.js OhlcBuilder.js, EmaBuilder.js, Analyzer.js 등이 내부에서 수행된다.

## Selector.js
- convert redis table 

## OHLC_Builder.js

## MACD_Builder.js

## Analyzer.js

## Notifier.js




