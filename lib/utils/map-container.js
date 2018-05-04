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
}

module.exports = MapContainer;