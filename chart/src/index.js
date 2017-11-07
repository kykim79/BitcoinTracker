import React from 'react';
import { render } from 'react-dom';
import Chart from './Chart';
import { getData } from './utils';

import { TypeChooser } from 'react-stockcharts/lib/helper';

var CURRENCY = 'ETH';

class ChartComponent extends React.Component {
    componentDidMount() {
        getData().then(data => {
            this.setState({ data });
        });
    }
    render() {
        if (this.state == null) {
            return <div>Loading...</div>;
        }
        return (
            <TypeChooser>
                {type => <Chart type={type} data={this.state.data} />}
            </TypeChooser>
        );
    }
}

render(
    <ChartComponent />,
    document.getElementById('root')
);

export function setCurrency() {
    // return '';
    return CURRENCY;
}