// const StringBuilder = require('string-builder');

// var bu = require('./btc_util');

// var sb = new StringBuilder();

// var updown = 'UP';
// var open = '12345678';
// var close = '12345678';
// var min = '12345678';
// var max = '12345678';
// var trend = '12345678';
// var anal = '12345678';
// var number = 123456;

// sb.append('-'.repeat(20)).appendLine();
// sb.appendFormat(" (now): {0}\n", updown)
// sb.appendFormat(" open: {0}\n", open);
// sb.appendFormat(' close: {0}\n', close);
// sb.appendFormat(' min: {0}\n', min);
// sb.appendFormat(' max: {0}\n', max);
// sb.appendFormat(' number1: {0}\n', bu.numeralPad(number));
// sb.appendFormat(' trend: {0}\n', trend);
// sb.appendFormat(' anal: {0}\n', anal);
// sb.append('-'.repeat(20)).appendLine();
// sb.appendFormat(' number2:');

// console.log(sb.toString());

const StringBuilder = require('ns-string-builder');

var sb = new StringBuilder();
var paragraphs = ["Why won't the ineffective paradox cruise? A medicine screams next to a class! The lord fulfills the chairman."];
sb
    .cat('<html>')
    .cat(
        '<head>',
        ['<title>', 'Demo String Builder', '</title>'],
        '</head>'
    )
    .cat('<body>')
    .wrap('<h1>', '</h1>')
    .cat('Hello World!!')
    .end()
    .wrap('<p>', '</p>')
    .each(paragraphs, function(paragraphs) {
        this.cat(paragraphs)
    })
    .end()
    .cat('</body>')
    .cat('</html>');

console.log(sb.string());


var sb1 = new StringBuilder();
    sb1.cat('hello');
    sb1.cat('Javascript', 'crazy', 'world').cat('!!!');
    sb1.cat(['nestedValue1', 'nestedValue2']).cat(() => 'Hello my Function');
    
console.log(sb1.string());


var sb2 = new StringBuilder();
    sb2.cat('Can I go,').rep('please ', 2).rep('?',3);
    
console.log(sb2.string());
    
var myMood = 'happy';
var sb3 = new StringBuilder();
sb3.cat('Hello').catIf('EveryOne', myMood === 'happy');

console.log(sb3.string());

var sb4 = new StringBuilder();
sb4.cat('<ul>', '\n')
        .wrap('<li>', ['</li>' ,'\n'])
        .rep('list item', 2)
        .end()
        .cat('</ul>'); // <ul>\n<li>list item</li>\n<li>list item</li>\n</ul>         
        
console.log(sb4.string());

// var sb5 = new StringBuilder();
// sb5.suffix('\n')
//         .wrap('<p>', '</p>')
//         .each(fixtures.peopleWithGender, function(person) {
//             this.when(person.sex == 'm', () => { return person.name + ' is male' }, [ person.name,' is female' ]);
//         });
 
// sb5.string() // <p>pedro is male</p>\n<p>leticia is female</p>\n<p>pablo is male</p>\n; 