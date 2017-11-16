let bb = ['SB', 'qq', 'sb n', 'SbN', 'sbba', 'sb bn', 'sb cb+123', 'sbbb+123k', 'sb bb+123k', 'SB BB+123K', 'SB BB+123k', 'SB           BB         +123k', 'SB Bb+123K', 'sB Bb123K', 'sb Bb 123k', 'sb Bb     +123k', 'sB ba', 'sbbn', 'sb bn ', 'sb'];
const mt = /^sb\s*(?:(?:[]?)|(?:([n]))|(?:([bxce])([n|a]))|(?:([bxce])([bsgh])\s*([+-]?)((?:\d+.\d+)|(?:\d+))(k?)))\s*$/i;

bb.forEach((t) => {
    console.log('> ' + t + '<');
    let rr = t.match(mt);
    if (rr) {
        rr.forEach((e, i) => {
            let x = (!e) ? ' not e ' : ' e'
            console.log(i + ': ' + e + x)
        });
    }
});

