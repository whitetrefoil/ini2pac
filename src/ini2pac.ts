/// <reference path='../references/node/node.d.ts' />
/// <reference path='../references/ini/ini.d.ts' />

/*

 ;Example:

 [proxy]
 host=localhost
 port=12345
 type=socks5

 ; optional
 [exception]
 *localhost*
 baidu.com

 ; optional
 [nation]
 *facebook*
 *google*
 youtube.com
 twitter.com

 ; optional
 [company]
 taobao.com
 qq.com

 */

var fs = require('fs');
var util = require('util');
var ini = require('ini');

const HEAD = 'function FindProxyForURL(url,host){host=host.toLowerCase();';
const RETURN_PROXY = 'return "{{TYPE}} {{HOST}}:{{PORT}}";';
const RETURN_DIRECT = 'return "DIRECT";';
const TAIL = '}';

enum ProxyType {Http, Socks4, Socks5}

interface PacGroup {
  nation?: string;
  company?: string;
}

interface IniOptions {
  proxy: {
    host: string;
    port: string;
    type: ProxyType;
  }
  exception?: string[];
  nation?: string[];
  company?: string[];
}

interface IniOptionsInput {
  proxy: {
    host: string;
    port: string;
    type: string;
  }
  exception?: string[];
  nation?: string[];
  company?: string[];
}

class Options {
  private static defaultOptions:IniOptions = {
    proxy: {
      host: '127.0.0.1',
      port: '8080',
      type: ProxyType.Http
    },
    exception: [],
    nation: [],
    company: []
  };

  private iniOptions:IniOptions;

  private static parse(str:string):IniOptions {
    try {
      var parsing = Options.defaultOptions;
      var decoded = <IniOptionsInput>ini.decode(str);
      if (typeof decoded.proxy.host === 'string') parsing.proxy.host = decoded.proxy.host;
      if (typeof decoded.proxy.port === 'number') parsing.proxy.port = decoded.proxy.port;
      if (typeof decoded.proxy.type === 'string') {
        switch(decoded.proxy.type.toLowerCase()) {
        case 'socks':
        case 'socks4':
          // TODO: socks4
        case 'socks5':
          parsing.proxy.type = ProxyType.Socks5;
          break;
        default:
          parsing.proxy.type = ProxyType.Http;
        }
      }
      if (decoded.exception != null) parsing.exception = Object.keys(decoded.exception);
      if (decoded.nation != null) parsing.nation = Object.keys(decoded.nation);
      if (decoded.company != null) parsing.company = Object.keys(decoded.company);
    } catch (e) {
      console.error('Failed to parse the INI file.  Check the details below:');
      console.error(e.stack);
      throw(e);
    }

    return parsing;
  }

  private static convertProxyTypeToPacFormat(type:ProxyType):string {
    switch (type) {
    case ProxyType.Socks4:
      // TODO
    case ProxyType.Socks5:
      return 'SOCKS5';
    default:
      return 'PROXY';
    }
  }

  private static patternToCondition(pattern:string):string {
    return pattern.indexOf('*') >= 0
      ? '||dnsDomainIs(host,"' + pattern + '")'
      : '||shExpMatch(host,"' + pattern + '")';
  }

  compose():PacGroup {
    try {
      var exception = '';
      var nation = '';
      var company = '';
      var returnProxy = RETURN_PROXY
        .replace('{{HOST}}', this.iniOptions.proxy.host)
        .replace('{{PORT}}', this.iniOptions.proxy.port)
        .replace('{{TYPE}}', Options.convertProxyTypeToPacFormat(this.iniOptions.proxy.type));

      // Exception
      if (this.iniOptions.exception.length > 0) {
        this.iniOptions.exception.forEach(function(cond:string) {
          exception += Options.patternToCondition(cond);
        });
        exception = 'if(' + exception.substr(2) + ')' + RETURN_DIRECT + 'else ';
      }

      // Nation
      this.iniOptions.nation.forEach(function(cond:string) {
        nation += Options.patternToCondition(cond);
      });

      // Company
      company = nation;
      this.iniOptions.company.forEach(function(cond:string) {
        company += Options.patternToCondition(cond);
      });

      nation = nation.length === 0 ? '' : exception + 'if(' + nation.substr(2) + ')' + returnProxy + 'else ';
      company = company.length === 0 ? '' : exception + 'if(' + company.substr(2) + ')' + returnProxy + 'else ';
    } catch(e) {
      console.error('Failed to compose the PAC files.  Check the details below:');
      console.error(e.stack);
      throw(e);
    }

    return {
      nation: HEAD + nation + RETURN_DIRECT + TAIL,
      company: HEAD + company + RETURN_DIRECT + TAIL
    };
  }

  constructor(iniStr:string) {
    this.iniOptions = Options.parse(iniStr);
  }
}

function readIni(path:string):string {
  try {
    return fs.readFileSync(path, {encoding: 'utf8'});
  } catch (e) {
    console.error('Failed to open the INI file.  Check the details below:');
    console.error(e.stack);
  }
}

function writePac(filename:string, str:string, encoding = 'utf8'):void {
  try {
    fs.writeFileSync(filename, str, { encoding: encoding });
  } catch(e) {
    console.error('Failed to write the PAC files.  Check the details below:');
    console.error(e.stack);
    throw(e);
  }
}

var ini2Pac = function ini2Pac(path:string):void {
  var iniFileContent = readIni(path);
  var options = new Options(iniFileContent);
  var pacGroup = options.compose();

  writePac('nation.pac', pacGroup.nation);
  writePac('company.pac', pacGroup.company);

  util.log('DONE!');
};

if (require.main === module) {
  ini2Pac(process.argv[2]);
} else {
  module.exports = ini2Pac;
}
