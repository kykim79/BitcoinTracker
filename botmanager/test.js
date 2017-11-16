var assert = require('assert');
describe('Array', function() {
    describe('#indexOf()', function() {
        it('Should return -1 when the value is not present', function() {
            assert.equal(-1, [1,2,3].indexOf(4));
        });
    });
});

describe('botManager', function() {
    describe('#updatePrice()', function() {
        it('Should return 2 ', function() {
            var botManager = require('./botManager.js');
            assert.equal(botManager.updatePrice('+', 1, 1), 2);
        });
    });
});