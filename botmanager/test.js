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
        let testNoParamFunc1 = () => THIS_IS_TEST_RESULT;
        let testNoParamFunc2 = () => THIS_IS_TEST_RESULT;

        it('정상적으로 실행되면 함수의 실행 결과를 리턴한다', function () {
            commandHelper.addCommand(/sb/, testNoParamFunc1);
            assert.deepEqual(commandHelper.execute('sb'), [THIS_IS_TEST_RESULT]);
        });

        it('명령2가 실행되면 2개의 실행결과를 리턴한다.', function () {
            commandHelper.addCommand(/sb/, testNoParamFunc1);
            commandHelper.addCommand(/sb/, testNoParamFunc2)
            assert.deepEqual(commandHelper.execute('sb'), [THIS_IS_TEST_RESULT, THIS_IS_TEST_RESULT]);
        });

        it('Regex에 매치되지 않으면 undefined를 리턴한다', function () {
            commandHelper.addCommand(/sb/, testNoParamFunc1);
            assert.deepEqual(commandHelper.execute('test'), []);
        });

        let testParamFunc2 = (match) => null;

        it('정상적으로 실행되면 regex에 매치된 결과에서 capture된 부분을 리턴한다.2', function () {
            commandHelper.addCommand(/sb (test)$/, testParamFunc2);
            assert.deepEqual(commandHelper.execute('sb test'), [null]);
        });
    });

    describe('함수 실행 with params', function () {
        let testParamFunc1 = (match) => TEST_PARAM1;

        it('정상적으로 실행되면 함수의 실행 결과(param array의 첫번째 값)를 리턴한다', function () {
            commandHelper.addCommand(/sb (test)$/, testParamFunc1);
            assert.deepEqual(commandHelper.execute('sb test'), [TEST_PARAM1]);
        });

        it('Regex에 매치되지 않으면 undefined를 리턴한다', function () {
            commandHelper.addCommand(/sb/, testParamFunc1);
            assert.deepEqual(commandHelper.execute('test'), []);
        });
    });

    describe('함수 실행 with params included match result', function () {

        let testParamFunc = (match) =>  match[1];

        it('정상적으로 실행되면 regex에 매치된 결과에서 capture된 부분을 리턴한다.', function () {
            commandHelper.addCommand(/sb (test)/, testParamFunc);
            assert.deepEqual(commandHelper.execute('sb test'), ['test']);
        });

        it('Regex에 매치되지 않으면 undefined를 리턴한다', function () {
            commandHelper.addCommand(/sb/, testParamFunc);
            assert.deepEqual(commandHelper.execute('test'), []);
        });
    });

    describe('명령어를 처리할 수 없는 경우 invalidHandler를 처리하는지 확인', function () {

        it('실제 입력 코맨드가 명령어 리스트에 없는 경우 invalidHandler의 결과가 반환된다. ', function () {
            let invalidHandler = () => true;
            commandHelper.addInvalidHandler(invalidHandler);
            assert.equal(commandHelper.execute('sb test'), true);
        });

        it('InvalidHandler를 설정하지 않는 경우 기본 invalidHandler의 결과값(empty array)이 반환된다', function () {
            assert.deepEqual(commandHelper.execute('sb test'), []);
        });
    });


    describe('execute 실행시 설정된 validator가 실행되는지 확인', function () {
        let falseValidator = () => false;
        let testParamFunc = (match) =>  match[1];

        it('validator가 false를 return하는 경우 command가 수행되지 않고 false를 return하게 된다. ', function () {
            commandHelper.addCommand(/sb (test)/, testParamFunc, falseValidator);
            assert.deepEqual(commandHelper.execute('sb test'), [false]);
        });

        it('validator를 설정하지 않은 경우에는 command가 수행결과를 return하게 된다.', function () {
            commandHelper.addCommand(/sb (test)/, testParamFunc);
            assert.deepEqual(commandHelper.execute('sb test'), ['test']);
        });


        it('2개의 명령어를 실행하는 경우 validator의 결과는 각각 반환된다.', function () {
            commandHelper.addCommand(/sb (test)/, testParamFunc, falseValidator);
            commandHelper.addCommand(/sb (test)/, testParamFunc);
            assert.deepEqual(commandHelper.execute('sb test'), [false, 'test']);
        });
    });
});