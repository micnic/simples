'use strict';

const dynamicKeys = ['dynamic', 'fixed'];
const routesKeys = ['all', 'delete', 'get', 'patch', 'post', 'put'];

class MapContainer {

	/**
	 * Create an object container with maps
	 * @param {string[]} args
	 */
	static create(...args) {

		const container = Object.create(null);

		// Create a new map for each argument
		args.forEach((arg) => {
			container[arg] = new Map();
		});

		return container;
	}

	/**
	 * Create a map container with fixed and dynamic keys
	 * @returns {*}
	 */
	static dynamic() {

		return MapContainer.create(...dynamicKeys);
	}

	/**
	 * Create a map container with routes verbs keys
	 * @returns {*}
	 */
	static routes() {

		return MapContainer.create(...routesKeys);
	}
}

module.exports = MapContainer;