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
var ProxyType;
(function (ProxyType) {
    ProxyType[ProxyType["Http"] = 0] = "Http";
    ProxyType[ProxyType["Socks4"] = 1] = "Socks4";
    ProxyType[ProxyType["Socks5"] = 2] = "Socks5";
})(ProxyType || (ProxyType = {}));
var fs = require('fs');
var util = require('util');
var ini = require('ini');
const HEAD = 'function FindProxyForURL(url,host){host=host.toLowerCase();';
const RETURN_PROXY = 'return "{{TYPE}} {{HOST}}:{{PORT}}";';
const RETURN_DIRECT = 'return "DIRECT";';
const TAIL = '}';
var Options = (function () {
    function Options(iniStr) {
        this.iniOptions = Options.parse(iniStr);
    }
    Options.parseDomainsAndKeywords = function (input) {
        var domains = [];
        var keywords = [];
        input.forEach(function (segment) {
            if (segment.indexOf('*') >= 0) {
                keywords.push(segment.replace(/\*/g, ''));
            }
            else {
                domains.push(segment);
            }
        });
        return {
            domains: domains.sort(),
            keywords: keywords.sort()
        };
    };
    Options.parse = function (str) {
        try {
            var parsing = Options.defaultOptions;
            var decoded = ini.decode(str);
            if (typeof decoded.proxy.host === 'string')
                parsing.proxy.host = decoded.proxy.host;
            if (typeof decoded.proxy.port === 'string')
                parsing.proxy.port = decoded.proxy.port;
            if (typeof decoded.proxy.type === 'string') {
                switch (decoded.proxy.type.toLowerCase()) {
                    case 'socks':
                    case 'socks4':
                    case 'socks5':
                        parsing.proxy.type = 2 /* Socks5 */;
                        break;
                    default:
                        parsing.proxy.type = 0 /* Http */;
                }
            }
            parsing.exception = decoded.exception != null ? Options.parseDomainsAndKeywords(Object.keys(decoded.exception)) : [];
            if (decoded.nation != null)
                parsing.nation = Options.parseDomainsAndKeywords(Object.keys(decoded.nation));
            if (decoded.company != null)
                parsing.company = Options.parseDomainsAndKeywords(Object.keys(decoded.company));
        }
        catch (e) {
            console.error('Failed to parse the INI file.  Check the details below:');
            console.error(e.stack);
            throw (e);
        }
        return parsing;
    };
    Options.convertProxyTypeToPacFormat = function (type) {
        switch (type) {
            case 1 /* Socks4 */:
            case 2 /* Socks5 */:
                return 'SOCKS5';
            default:
                return 'PROXY';
        }
    };
    Options.prototype.compose = function (isCompanyIncluded) {
        if (isCompanyIncluded === void 0) { isCompanyIncluded = false; }
        var exception = '';
        var match = '';
        try {
            var returnProxy = RETURN_PROXY.replace('{{HOST}}', this.iniOptions.proxy.host).replace('{{PORT}}', this.iniOptions.proxy.port).replace('{{TYPE}}', Options.convertProxyTypeToPacFormat(this.iniOptions.proxy.type));
            // Exception
            if (this.iniOptions.exception != null) {
                if (this.iniOptions.exception.keywords != null) {
                    this.iniOptions.exception.keywords.forEach(function (keyword) {
                        exception += '||(url.indexOf("' + keyword + '") >= 0)';
                    });
                }
                if (this.iniOptions.exception.domains != null) {
                    this.iniOptions.exception.domains.forEach(function (domain) {
                        exception += '||dnsDomainIs(host,"' + domain + '")';
                    });
                }
            }
            if (exception !== '') {
                exception = 'if(' + exception.substr(2) + ')' + RETURN_DIRECT + 'else ';
            }
            // Keywords
            this.iniOptions.nation.keywords.forEach(function (keyword) {
                match += '||(url.indexOf("' + keyword + '") >= 0)';
            });
            if (isCompanyIncluded === true) {
                this.iniOptions.company.keywords.forEach(function (keyword) {
                    match += '||(url.indexOf("' + keyword + '") >= 0)';
                });
            }
            // Domains
            this.iniOptions.nation.domains.forEach(function (domain) {
                match += '||dnsDomainIs(host,"' + domain + '")';
            });
            if (isCompanyIncluded === true) {
                this.iniOptions.company.domains.forEach(function (domain) {
                    match += '||dnsDomainIs(host,"' + domain + '")';
                });
            }
            match = match.length === 0 ? '' : exception + 'if(' + match.substr(2) + ')' + returnProxy + 'else ';
        }
        catch (e) {
            console.error('Failed to compose the PAC files.  Check the details below:');
            console.error(e.stack);
            throw (e);
        }
        return HEAD + match + RETURN_DIRECT + TAIL;
    };
    Options.defaultOptions = {
        proxy: {
            host: '127.0.0.1',
            port: '8080',
            type: 0 /* Http */
        },
        exception: [],
        nation: {
            domains: [],
            keywords: []
        },
        company: {
            domains: [],
            keywords: []
        }
    };
    return Options;
})();
function readIni(path) {
    try {
        return fs.readFileSync(path, { encoding: 'utf8' });
    }
    catch (e) {
        console.error('Failed to open the INI file.  Check the details below:');
        console.error(e.stack);
    }
}
function writePac(filename, str, encoding) {
    if (encoding === void 0) { encoding = 'utf8'; }
    try {
        fs.writeFileSync(filename, str, { encoding: encoding });
    }
    catch (e) {
        console.error('Failed to write the PAC files.  Check the details below:');
        console.error(e.stack);
        throw (e);
    }
}
var ini2Pac = function ini2Pac(path) {
    var iniFileContent = readIni(path);
    var options = new Options(iniFileContent);
    writePac('nation.pac', options.compose());
    writePac('company.pac', options.compose(true));
    util.log('DONE!');
};
if (require.main === module) {
    ini2Pac(process.argv[2]);
}
else {
    module.exports = ini2Pac;
}
//# sourceMappingURL=ini2pac.js.map