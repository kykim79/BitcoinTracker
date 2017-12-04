import { csvParse } from  'd3-dsv';
import { timeParse } from 'd3-time-format';

function parseData(parse) {
    return function(d) {
        d.date = parse(d.date);
        d.open = +(d.open/1000);
        d.high = +(d.high/1000);
        d.low = +(d.low/1000);
        d.close = +(d.close/1000);
        d.volume = +d.volume;

        return d;
    };
}

//const parseDate = timeParse("%Y-%m-%d");
const parseDate = timeParse('%Y-%m-%d %H:%M');

export function getData() {
    /* global fetch */
    const promiseMSFT = fetch('./data/CandleData.csv')
        .then(response => response.text())
        .then(data => csvParse(data, parseData(parseDate)));
    return promiseMSFT;
}
