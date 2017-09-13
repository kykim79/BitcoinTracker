"use strict";
var util = require("util");
var moment = require('moment');
require('moment-timezone');

// 빗썸Ticker 형식을 처리하는 CoinInfo 클래스
// content필드는 bithumb 형식이어야만 한다.
//
// example)
//
// { status: '0000',                    결과 상태 코드 (정상 : 0000, 정상이외 코드는 에러 코드 참조)
//   data: 
//   { opening_price: '5296000',        최근 24시간 내 시작 거래금액
//     closing_price: '4921000',        최근 24시간 내 마지막 거래금액
//     min_price: '4920000',            최근 24시간 내 최저 거래금액
//     max_price: '5510000',            최근 24시간 내 최고 거래금액
//     average_price: '5213652.5821',   최근 24시간 내 평균 거래금액
//     units_traded: '19096.96943903',  최근 24시간 내 Currency 거래량
//     volume_1day: '19096.96943903',   최근 1일간 Currency 거래량
//     volume_7day: '96010.86877491',   최근 7일간 Currency 거래량
//     buy_price: '4922000',            거래 대기건 최고 구매가
//     sell_price: '4948000',           거래 대기건 최소 판매가
//     date: '1504383990823'            현재시간 Epoch (unix time)
//   } 
// }


module.exports = class CoinInfo {
  // constructor (content, coinInfos) {
  constructor (content) {
    // this.date = moment(new Date(Number(content.data.date))).tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss');    
    // this.date = moment.tz('Asia/Seoul').format("YYYY-MM-DD HH:mm:ss");    
    this.date = Number(content.data.date);
    this.oprice = Number(content.data.opening_price);  
    this.cprice = Number(content.data.closing_price);
    this.mprice = Number(content.data.min_price);
    this.xprice = Number(content.data.max_price);
    this.aprice = Number(content.data.average_price);
    this.traded = Number(content.data.units_traded);
    this.vol_1day = Number(content.data.volume_1day);
    this.vol_7day = Number(content.data.volume_7day);
    this.bprice = Number(content.data.buy_price);
    this.sprice = Number(content.data.sell_price);

    // 여기 이후는 original xml에 없는 필드, 계산에 의해 설정됨
    this.tprice = 0;   // trend price
    this.updown = '^';  // interval smooth로 계산후 설정, 바로 앞 tprice 보다의  up/down
    this.trend =  'w';   // updown의 변화가 있는지 ? w -> u,d
    this.ocupdown = this.oprice < this.cprice ? 'u':'d';  // 24hour open close 비교

    // https://ko.wikipedia.org/wiki/SOLID
    // SOLID는 OOP 프로그래밍의 중요한 5가지 원칙입니다.
    // 그중의 하나인 SRP는 하나의 클래스는 하나의 책임만 져야 한다는 원칙이죠
    // 메소드도 마찬가지로 하나의 메소드는 하나의 목적만을 위해 작성되어야 합니다.
  }

  toString() {
    return util.format("BTC,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s", 
    this.date, this.oprice, this.cprice, this.mprice, this.xprice, this.aprice, 
    this.traded, this.vol_1day, this.vol_7day, this.bprice, this.sprice,
    this.tprice,this.updown,this.trend,this.ocupdown);
  }

}
