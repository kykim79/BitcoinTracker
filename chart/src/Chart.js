
import React from 'react';
import PropTypes from 'prop-types';

import { format } from 'd3-format';
import { timeFormat } from 'd3-time-format';

import { ChartCanvas, Chart } from 'react-stockcharts';
import {
    BarSeries,
    AreaSeries,
    CandlestickSeries,
    LineSeries,
    MACDSeries,
} from 'react-stockcharts/lib/series';
import { XAxis, YAxis } from 'react-stockcharts/lib/axes';
import {
    CrossHairCursor,
    EdgeIndicator,
    CurrentCoordinate,
    MouseCoordinateX,
    MouseCoordinateY,
} from 'react-stockcharts/lib/coordinates';

import { discontinuousTimeScaleProvider } from 'react-stockcharts/lib/scale';
import { ema, macd, sma } from 'react-stockcharts/lib/indicator';
import { fitWidth } from 'react-stockcharts/lib/helper';

const macdAppearance = {
    stroke: {
        macd: '#FF0000',
        signal: '#00F300',
    },
    fill: {
        divergence: '#4682B4'
    },
};

class CandleStickChartWithMACDIndicator extends React.Component {
    render() {
        const { type, data: initialData, width, ratio } = this.props;
        const ema26 = ema()
            .id(0)
            .options({ windowSize: 17 })
            .merge((d, c) => { d.ema26 = c; })
            .accessor(d => d.ema26);

        const ema12 = ema()
            .id(1)
            .options({ windowSize: 8 })
            .merge((d, c) => {d.ema12 = c;})
            .accessor(d => d.ema12);

        const macdCalculator = macd()
            .options({
                fast: 8,
                slow: 17,
                signal: 5,
            })
            .merge((d, c) => {d.macd = c;})
            .accessor(d => d.macd);

        const smaVolume50 = sma()
            .id(3)
            .options({
                windowSize: 17,
                sourcePath: 'volume',
            })
            .merge((d, c) => {d.smaVolume50 = c;})
            .accessor(d => d.smaVolume50);

        const calculatedData = smaVolume50(macdCalculator(ema12(ema26(initialData))));
        const xScaleProvider = discontinuousTimeScaleProvider
            .inputDateAccessor(d => d.date);
        const {
            data,
            xScale,
            xAccessor,
            displayXAccessor,
        } = xScaleProvider(calculatedData);

        return (
            <ChartCanvas height={700}
                width={width}
                ratio={ratio}
                margin={{ left: 70, right: 70, top: 20, bottom: 30 }}
                type={type}
                seriesName="MSFT"
                data={data}
                xScale={xScale}
                xAccessor={xAccessor}
                displayXAccessor={displayXAccessor}
            >
                <Chart id={1} height={400} // candle chart
                    yExtents={[d => [d.high  , d.low ], ema26.accessor(), ema12.accessor()]}
                    padding={{ top: 0, bottom: 20 }}
                >
                    <XAxis axisAt="bottom" orient="bottom" showTicks={false} outerTickSize={0} />
                    <YAxis axisAt="right" orient="right" ticks={10} />

                    <MouseCoordinateX
                        at="top"
                        orient="top"
                        displayFormat={timeFormat('%m-%d %H:%M')} />

                    <MouseCoordinateY
                        at="left"
                        orient="left"
                        displayFormat={format(',d')} />

                    <CandlestickSeries />
                    <LineSeries yAccessor={ema26.accessor()} stroke={ema26.stroke()}/>
                    <LineSeries yAccessor={ema12.accessor()} stroke={ema12.stroke()}/>

                    <CurrentCoordinate yAccessor={ema26.accessor()} fill={ema26.stroke()} />
                    <CurrentCoordinate yAccessor={ema12.accessor()} fill={ema12.stroke()} />

                    <EdgeIndicator itemType="last" orient="right" edgeAt="right"
                        yAccessor={d => d.close} fill={d => d.close > d.open ? '#6BA583' : '#FF0000'}/>
                </Chart>
                <Chart id={2} height={100}  // volume bar chart
                    yExtents={[d => d.volume, smaVolume50.accessor()]}
                    origin={(w, h) => [0, h - 260]}
                >
                    <YAxis axisAt="left" orient="left" ticks={5} tickFormat={format('.0s')}/>

                    <MouseCoordinateY
                        at="left"
                        orient="left"
                        displayFormat={format('.4s')} />
                    <MouseCoordinateX
                        at="top"
                        orient="top"
                        displayFormat={timeFormat('%m-%d %H:%M')} />

                    <BarSeries yAccessor={d => d.volume} fill={d => d.close > d.open ? '#6BA583' : '#FF0000'} />
                    <AreaSeries yAccessor={smaVolume50.accessor()} stroke={smaVolume50.stroke()} fill={smaVolume50.fill()}/>
                </Chart>

                <Chart id={3} height={80}  // histogram chart
                    yExtents={macdCalculator.accessor()}
                    origin={(w, h) => [0, h - 160]} padding={{ top: 0, bottom: 0 }}
                >
                    <XAxis axisAt="bottom" orient="bottom"/>
                    <YAxis axisAt="right" orient="right" ticks={4} />

                    <MouseCoordinateX
                        at="bottom"
                        orient="bottom"
                        displayFormat={timeFormat('%m-%d %H:%M')} />
                    <MouseCoordinateY
                        at="right"
                        orient="right"
                        displayFormat={format(',d')} />

                    <MACDSeries yAccessor={d => d.macd}
                        {...macdAppearance} />
                </Chart>
                <CrossHairCursor />
            </ChartCanvas>
        );
    }
}

// CandleStickChartWithMACDIndicator.propTypes = {
//     data: PropTypes.array.isRequired,
//     width: PropTypes.number.isRequired,
//     ratio: PropTypes.number.isRequired,
//     // type: PropTypes.oneOf(['svg', 'hybrid']).isRequired,
// };

// CandleStickChartWithMACDIndicator.defaultProps = {
//     type: 'svg',
// };

CandleStickChartWithMACDIndicator = fitWidth(CandleStickChartWithMACDIndicator);

export default CandleStickChartWithMACDIndicator;
