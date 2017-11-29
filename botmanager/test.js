let assert = require('assert');


const CommandHelper = require('./commandHelper');


describe('CommandHelper Test', function() {
    const THIS_IS_TEST_RESULT = 'This is test result';
    const TEST_PARAM1 = 'test param1';
    const TEST_PARAM2 = 'test param2';

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

        // 같은 명령어로 여러 함수를 할당하면 하나의 명령어로 여러가지 함수를 실행시킬 수 있음.
        it('중복된 command가 추가되도 중복된 갯수의 command가 존재해야 한다.', function () {
            commandHelper.addCommand('aa', testNoParamFunc, '');
            commandHelper.addCommand('aa', testNoParamFunc, '');
            assert.equal(commandHelper.commandCount('aa'), 2);
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

        let testParamFunc2 = (match) => null;

        it('정상적으로 실행되면 regex에 매치된 결과에서 capture된 부분을 리턴한다.2', function () {
            commandHelper.addCommand(/sb (test)$/, testParamFunc2);
            assert.deepEqual(commandHelper.execute('sb test'), [null]);
        });
    });

    describe('함수 실행 with params', function () {
        let testParamFunc1 = (match, params) => params[0];

        it('정상적으로 실행되면 함수의 실행 결과(param array의 첫번째 값)를 리턴한다', function () {
            commandHelper.addCommand(/sb (test)$/, testParamFunc1, [TEST_PARAM1]);
            assert.deepEqual(commandHelper.execute('sb test'), [TEST_PARAM1]);
        });

        let testParamFunc2 = (match, params) => {
            return THIS_IS_TEST_RESULT + ': ' + params[0] + ', ' + params[1];
        };

        it('정상적으로 실행되면 함수의 실행 결과를 리턴한다', function () {
            commandHelper.addCommand(/sb/, testParamFunc2, [TEST_PARAM1, TEST_PARAM2]);
            assert.deepEqual(commandHelper.execute('sb'), [THIS_IS_TEST_RESULT + ': ' + TEST_PARAM1 + ', ' + TEST_PARAM2]);
        });

        it('Regex에 매치되지 않으면 undefined를 리턴한다', function () {
            commandHelper.addCommand(/sb/, testParamFunc2, [TEST_PARAM1, TEST_PARAM2]);
            assert.deepEqual(commandHelper.execute('test'), []);
        });
    });

    describe('함수 실행 with params included match result', function () {

        let testParamFunc = (match, params) =>  match[1];

        it('정상적으로 실행되면 regex에 매치된 결과에서 capture된 부분을 리턴한다.', function () {
            commandHelper.addCommand(/sb (test)/, testParamFunc, [TEST_PARAM1, TEST_PARAM2]);
            assert.deepEqual(commandHelper.execute('sb test'), ['test']);
        });

        it('Regex에 매치되지 않으면 undefined를 리턴한다', function () {
            commandHelper.addCommand(/sb/, testParamFunc, [TEST_PARAM1, TEST_PARAM2]);
            assert.deepEqual(commandHelper.execute('test'), []);
        });
    });

    describe('명령어가 제대로 들어가는지 확인', function () {

        let invalidHander = () => true;

        it('InvalidHandler가 있고 실제 입력 코맨드가 명령어 리스트에 업는 경우 인밸리드 로직을 탄다 ', function () {
            commandHelper.addInvalidHandler(invalidHander);
            assert.equal(commandHelper.execute('sb test'), true);
        });

        it('InvalidHandler가 없는 경우라서 아무런 응답이 없어야 함.', function () {
            assert.deepEqual(commandHelper.execute('sb test'), []);
        });
    });
});