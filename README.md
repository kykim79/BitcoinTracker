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

### json에 포함된 내용들
```js
{
  "crawler": {                // btcCrawler.js 에서 사용
    "cron": "*/30 * * * * *", // crawler를 얼마마다 수행할 지 설정
    "maxCount": 4000          // crawler 결과를 얼마나 보관할 지 
  },
    "selector": {             // btcSelector.js 에서 사용
    "cron": "5 */4 * * * *"   // selector,ohlc,ema,analyzer를 얼마 마다 수행할지 결정
  },
  "ohlc": {                   // btcOhlcBuilder.js 에서 사용
    "splitSize": 10           // crawler에서 저장된 자료를 어느 크기로 잘라서 Open, High, Low, Close를 계산할 지 결정
  },
  "ema": {                    // btcEmaBuilder.js 에서 사용
    "emaSize": 15             // ema를 어느 정도로 부드럽게 계산할지 결정
  },
  "analyzer": {               // btcAnalyzer.js 에서 사용
    "target": {     
      "gapAmount": 20000,     // ema 값이 현재 가격과 접근하면 alert하기 위한 편차 정의
      "buy": 4350300,         // 희망 사자 가격
      "sell": 5074580,        // 희망 팔자 가격
      "volumeHigh": 1300,     // 매매가 아주 활발하면 확인 필요
      "Want2Sell": true,      // 팔자를 monitor 할까?
      "Want2Buy": true,       // 사자를 monitor 할까?
      "buyCount": 0,          // 사자 쪽으로 많이 기울어지고 있는 건지?
      "sellCount": 25,        // 팔자 쪽으로 많이 기울어지고 있는 건지?
      "maxCount": 25          // buy,sell Count maximum sett
    }
  }
}
```
