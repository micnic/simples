var requestInterface = require('../lib/request');

var host = {
	sessions: {
		'0aA1bB2c': {
			_name: '0aA1bB2c',
			_timeout: 60000,
			data: 'data'
		}
	}
};

var request = {
	headers: {
		'accept-language': 'aa;q=0.8,ab;q=0.6,ac',
		cookie: '_session=0aA1bB2c; cookie=cookie'
	}
};

var parsedCookies = requestInterface.parseCookies(request, host);

clearTimeout(host.sessions['0aA1bB2c']._timeout);

var parsedLangs = requestInterface.parseLangs(request);

console.log('cookies: ', parsedCookies.cookies, '\nsession: ', parsedCookies.session, '\nlangs: ', parsedLangs);