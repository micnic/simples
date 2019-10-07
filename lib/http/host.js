'use strict';

const Router = require('simples/lib/http/router');
const MapContainer = require('simples/lib/utils/map-container');
const RouteUtils = require('simples/lib/utils/route-utils');

const ignoreCase = 'i'; // Ignore case flag for pattern match
const matchStart = '^'; // Match start for regular expressions
const matchEnd = '$'; // Match end for regular expressions
const wildcardRex = /\*/g; // Regular expression for matching wildcards
const wildcardReplace = '[^.]+'; // Replace for wildcards

class HTTPHost extends Router {

	/**
	 * HTTP host constructor
	 * @param {string} name
	 */
	constructor(name) {

		const pattern = RouteUtils.escapeRegExpString(name)
			.replace(wildcardRex, wildcardReplace);

		super(null, null);

		// Set host name pattern
		this._pattern = RegExp(matchStart + pattern + matchEnd, ignoreCase);

		// Set HTTP host routers container
		this._routers = MapContainer.dynamic();

		// Set HTTP host routes container
		this._routes = {
			dynamic: MapContainer.routes(),
			fixed: MapContainer.routes(),
			ws: MapContainer.dynamic()
		};
	}
}

module.exports = HTTPHost;