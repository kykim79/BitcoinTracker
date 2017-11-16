let assert = require('assert');


const CommandHelper = require('./commandHelper');


describe('CommandHelper Test', function() {
    const THIS_IS_TEST_RESULT = 'This is test result';
    const TEST_PARAM1 = 'test param1';
    const TEST_PARAM2 = 'test param1';

    let commandHelper;

    beforeEach(() => {
        commandHelper = new CommandHelper();
    });

    describe('명령 추가', function () {
        let testNoParamFunc = () => THIS_IS_TEST_RESULT;

        it('command가 정상적으로 추가되면 command로 찾을수 있어야 함', function () {
            commandHelper.addCommand('aa', testNoParamFunc, '');
            assert.equal(commandHelper.hasCommand('aa'), true);
        });

        it('command가 추가되어 있지 않으면 리스트가 비어 있어야 함', function () {
            assert.equal(commandHelper.hasCommand(/.*/), false);
        });
    });

    describe('함수 실행 without param', function () {
        let testNoParamFunc = () => THIS_IS_TEST_RESULT;

        it('정상적으로 실행되면 함수의 실행 결과를 리턴한다', function () {
            commandHelper.addCommand(/sb/, testNoParamFunc);
            assert.deepEqual(commandHelper.execute('sb'), [THIS_IS_TEST_RESULT]);
        });

        it('Regex에 매치되지 않으면 undefined를 리턴한다', function () {
            commandHelper.addCommand(/sb/, testNoParamFunc);
            assert.deepEqual(commandHelper.execute('test'), []);
        });
    });

    describe('함수 실행 with params', function () {
        let testParamFunc = (match, [param1, param2]) => { return THIS_IS_TEST_RESULT + ': ' + param1 + ', ' + param2; };

        it('정상적으로 실행되면 함수의 실행 결과를 리턴한다', function () {
            commandHelper.addCommand(/sb/, testParamFunc, [TEST_PARAM1, TEST_PARAM2]);
            assert.deepEqual(commandHelper.execute('sb'), [THIS_IS_TEST_RESULT + ': ' + TEST_PARAM1 + ', ' + TEST_PARAM2]);
        });

        it('Regex에 매치되지 않으면 undefined를 리턴한다', function () {
            commandHelper.addCommand(/sb/, testParamFunc, [TEST_PARAM1, TEST_PARAM2]);
            assert.deepEqual(commandHelper.execute('test'), []);
        });
    });

    describe('함수 실행 with params included match result', function () {

        let testParamFunc = (match, [param1, param2]) =>  match[1];

        it('정상적으로 실행되면 regex에 매치된 결과에서 capture된 부분을 리턴한다.', function () {
            commandHelper.addCommand(/sb (test)/, testParamFunc, [TEST_PARAM1, TEST_PARAM2]);
            assert.deepEqual(commandHelper.execute('sb test'), ['test']);
        });

        it('Regex에 매치되지 않으면 undefined를 리턴한다', function () {
            commandHelper.addCommand(/sb/, testParamFunc, [TEST_PARAM1, TEST_PARAM2]);
            assert.deepEqual(commandHelper.execute('test'), []);
        });
    });
});