/// <reference path='../references/node/node.d.ts' />
/// <reference path='../references/lodash/lodash.d.ts' />
/// <reference path='../references/ini/ini.d.ts' />
var _ = require('lodash');
var ini = require('ini');
var fs = require('fs');
var sortPacIni = function sortPacIni(path) {
    var inistr = fs.readFileSync(path, { encoding: 'utf8' });
    var parsed = ini.decode(inistr);
    var sorted = {
        proxy: parsed.proxy
    };
    _.forEach(['exception', 'nation', 'company'], function (type) {
        sorted[type] = {};
        _(parsed[type]).keys().sortBy(function (key) {
            return key.replace(/^\*\./, '');
        }).forEach(function (key) {
            sorted[type][key] = true;
        }).value();
    });
    parsed.exception = sorted.exception;
    parsed.nation = sorted.nation;
    parsed.company = sorted.company;
    console.log('original');
    console.log(ini.encode(parsed));
    console.log('replaced');
    console.log(ini.encode(parsed).replace(/=true$/gm, ''));
    fs.writeFileSync(path + '.sorted', ini.encode(parsed).replace(/=true$/gm, ''), { encoding: 'utf8' });
};
if (require.main === module) {
    sortPacIni(process.argv[2]);
}
else {
    module.exports = sortPacIni;
}
//# sourceMappingURL=sort-pac-ini.js.map