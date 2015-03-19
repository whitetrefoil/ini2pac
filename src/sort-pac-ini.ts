/// <reference path='../references/node/node.d.ts' />
/// <reference path='../references/lodash/lodash.d.ts' />
/// <reference path='../references/ini/ini.d.ts' />

interface IniOptionsInput {
  proxy: {
    host: string
    port: string
    type: string
  }
  exception?: Object
  nation?: Object
  company?: Object
}

var _ = require('lodash');
var ini = require('ini');
var fs = require('fs');

var sortPacIni = function sortPacIni(path:string):void {
  var inistr:string = fs.readFileSync(path, {encoding: 'utf8'});
  var parsed = <IniOptionsInput>ini.decode(inistr);
  var sorted:IniOptionsInput = {
    proxy: parsed.proxy
  };

  _.forEach(['exception', 'nation', 'company'], function(type) {
    sorted[type] = {};

    _(parsed[type])
      .keys()
      .sortBy(function(key) {
        return key.replace(/^\*\.*/, '');
      })
      .forEach(function(key) {
        sorted[type][key] = true;
      })
      .value();
  });

  parsed.exception = sorted.exception;
  parsed.nation = sorted.nation;
  parsed.company = sorted.company;

  fs.writeFileSync(path + '.sorted', ini.encode(parsed).replace(/=true$/gm, ''), {encoding: 'utf8'});
};


if (require.main === module) {
  sortPacIni(process.argv[2]);
} else {
  module.exports = sortPacIni;
}
