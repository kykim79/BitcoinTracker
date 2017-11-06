import { csvParse } from  'd3-dsv';
import { timeParse } from 'd3-time-format';

function parseData(parse) {
    return function(d) {
        d.date = parse(d.date);
        d.open = +d.open;
        d.high = +d.high;
        d.low = +d.low;
        d.close = +d.close;
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
