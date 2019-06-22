'use strict';

const tap = require('tap');

const http = require('http');
const https = require('https');
const Request = require('simples/lib/client/request');

tap.test('Request.getRequester', (test) => {

	test.equal(Request.getRequester('http:'), http.request);
	test.equal(Request.getRequester('https:'), https.request);

	test.end();
});