'use strict';

class MapContainer {

	// Create an object container with maps
	static create(...args) {

		const container = {};

		// Create a new map for each argument
		args.forEach((arg) => {
			container[arg] = new Map();
		});

		return container;
	}

	// Create a map container with fixed and dynamic keys
	static dynamic() {

		const keys = ['dynamic', 'fixed'];

		return MapContainer.create(...keys);
	}

	// Create a map container with routes verbs keys
	static routes() {

		const keys = ['all', 'delete', 'get', 'patch', 'post', 'put'];

		return MapContainer.create(...keys);
	}
}

module.exports = MapContainer;