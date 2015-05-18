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


enum ProxyType {Http, Socks4, Socks5}

interface PacGroup {
  nation?: string
  company?: string
}

interface IniOptions {
  proxy: {
    host: string
    port: string
    type: ProxyType
  }
  exception?: DomainsAndKeywords
  nation?: DomainsAndKeywords
  company?: DomainsAndKeywords
}

interface DomainsAndKeywords {
  domains?: string[]
  keywords?: string[]
}

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


var fs = require('fs');
var util = require('util');
var ini = require('ini');


const HEAD = 'function FindProxyForURL(url,host){host=host.toLowerCase();';
const RETURN_PROXY = 'return "{{TYPE}} {{HOST}}:{{PORT}}";';
const RETURN_DIRECT = 'return "DIRECT";';
const TAIL = '}';

class Options {
  private static defaultOptions:IniOptions = {
    proxy: {
      host: '127.0.0.1',
      port: '8080',
      type: ProxyType.Http
    },
    exception: [],
    nation: {
      domains: [],
      keywords: []
    },
    company:  {
      domains: [],
      keywords: []
    }
  };

  private iniOptions:IniOptions;

  private static parseDomainsAndKeywords(input:string[]):DomainsAndKeywords {
    var domains = [];
    var keywords = [];
    input.forEach(function(segment:string):void {
      if (segment.indexOf('*') >= 0) {
        keywords.push(segment.replace(/\*/g, ''));
      } else {
        domains.push(segment);
      }
    });

    return {
      domains: domains.sort(),
      keywords: keywords.sort()
    };
  }

  private static parse(str:string):IniOptions {
    try {
      var parsing = Options.defaultOptions;
      var decoded = <IniOptionsInput>ini.decode(str);
      if (typeof decoded.proxy.host === 'string') parsing.proxy.host = decoded.proxy.host;
      if (typeof decoded.proxy.port === 'string') parsing.proxy.port = decoded.proxy.port;
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
      parsing.exception = decoded.exception != null
        ? Options.parseDomainsAndKeywords(Object.keys(decoded.exception))
        : [];
      if (decoded.nation != null) parsing.nation = Options.parseDomainsAndKeywords(Object.keys(decoded.nation));
      if (decoded.company != null) parsing.company = Options.parseDomainsAndKeywords(Object.keys(decoded.company));
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

  compose(isCompanyIncluded = false):string {
    var exception = '';
    var match = '';
    try {
      var returnProxy = RETURN_PROXY
        .replace('{{HOST}}', this.iniOptions.proxy.host)
        .replace('{{PORT}}', this.iniOptions.proxy.port)
        .replace('{{TYPE}}', Options.convertProxyTypeToPacFormat(this.iniOptions.proxy.type));

      // Exception
      if (this.iniOptions.exception != null) {
        if (this.iniOptions.exception.keywords != null) {
          this.iniOptions.exception.keywords.forEach(function(keyword:string) {
            exception += '||(url.indexOf("' + keyword + '") >= 0)'
          });
        }
        if (this.iniOptions.exception.domains != null) {
          this.iniOptions.exception.domains.forEach(function(domain:string) {
            exception += '||dnsDomainIs(host,"' + domain + '")'
          });
        }
      }
      if (exception !== '') {
        exception = 'if(' + exception.substr(2) + ')' + RETURN_DIRECT + 'else ';
      }

      // Keywords
      this.iniOptions.nation.keywords.forEach(function(keyword:string) {
        match += '||(url.indexOf("' + keyword + '") >= 0)'
      });
      if (isCompanyIncluded === true) {
        this.iniOptions.company.keywords.forEach(function(keyword:string) {
          match += '||(url.indexOf("' + keyword + '") >= 0)'
        });
      }

      // Domains
      this.iniOptions.nation.domains.forEach(function(domain:string) {
        match += '||dnsDomainIs(host,"' + domain + '")'
      });
      if (isCompanyIncluded === true) {
        this.iniOptions.company.domains.forEach(function(domain:string) {
          match += '||dnsDomainIs(host,"' + domain + '")'
        });
      }

      match = match.length === 0 ? '' : exception + 'if(' + match.substr(2) + ')' + returnProxy + 'else ';
    } catch(e) {
      console.error('Failed to compose the PAC files.  Check the details below:');
      console.error(e.stack);
      throw(e);
    }

    return HEAD + match + RETURN_DIRECT + TAIL;
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

  writePac('nation.pac', options.compose());
  writePac('company.pac', options.compose(true));

  util.log('DONE!');
};

if (require.main === module) {
  ini2Pac(process.argv[2]);
} else {
  module.exports = ini2Pac;
}
