'use strict';

class Config {

	// Return array option if available or use the default option
	static getArrayOption(option, defaultOption) {

		// Check for array option provided
		if (Array.isArray(option)) {
			return option;
		} else {
			return defaultOption;
		}
	}

	// Return boolean option, true for true option and false for any other case
	static getBooleanOption(option) {

		return (option === true);
	}

	// Extract configuration based on the schema and provided configs
	static getConfig(schema, ...configs) {

		const config = {};
		const mergedConfig = Object.assign.apply(Object, [{}].concat(configs));

		// Loop through the schema to get config definitions
		Object.keys(schema).forEach((key) => {

			const definition = schema[key];
			const option = mergedConfig[key];
			const configDefinition = Config.definitions[definition.type];

			// Set config value based on the provided definition and option
			config[key] = configDefinition(definition, option);
		});

		return config;
	}

	// Return enable option, which can be a boolean or a function option
	static getEnableOption(option) {

		// Check for option type
		if (typeof option === 'boolean') {
			return (option === true);
		} else if (typeof option === 'function') {
			return option;
		} else {
			return false;
		}
	}

	// Return function option or null in any other case
	static getFunctionOption(option) {

		// Check for function option provided
		if (typeof option === 'function') {
			return option;
		} else {
			return null;
		}
	}

	// Return option from a set or use the default option
	static getSetOption(option, set, defaultOption) {

		// Check if the option is available in the set
		if (set.has(option)) {
			return option;
		} else {
			return defaultOption;
		}
	}

	// Return number option or use the default option
	static getNumberOption(option, defaultOption) {

		// Check for number type and greater that zero value
		if (typeof option === 'number' && option >= 0) {
			return option;
		} else {
			return defaultOption;
		}
	}

	// Return object option, use the default option if available or null if not
	static getObjectOption(option, defaultOption) {

		// Check for option object type
		if (option && typeof option === 'object') {
			return option;
		} else if (defaultOption) {
			return defaultOption;
		} else {
			return null;
		}
	}

	// Return string option or empty string in any other case
	static getStringOption(option) {

		// Check string option provided
		if (typeof option === 'string') {
			return option;
		} else {
			return '';
		}
	}
}

// Set config defitions
Config.definitions = {
	array(definition, option) {

		return Config.getArrayOption(option, definition.default);
	},
	boolean(definition, option) {

		return Config.getBooleanOption(option);
	},
	enable(definition, option) {

		return Config.getEnableOption(option);
	},
	function(definition, option) {

		return Config.getFunctionOption(option);
	},
	number(definition, option) {

		return Config.getNumberOption(option, definition.default);
	},
	object(definition, option) {

		return Config.getObjectOption(option, definition.default);
	},
	set(definition, option) {

		return Config.getSetOption(option, definition.set, definition.default);
	},
	string(definition, option) {

		return Config.getStringOption(option);
	}
};

// Set config types
Config.types = {
	array: 'array',
	boolean: 'boolean',
	enable: 'enable',
	function: 'function',
	number: 'number',
	object: 'object',
	set: 'set',
	string: 'string'
};

module.exports = Config;