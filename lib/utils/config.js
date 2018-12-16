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
		const mergedConfig = Object.assign({}, ...configs);

		// Loop through the schema to get config definitions
		Object.keys(schema).forEach((key) => {

			const definition = schema[key];
			const option = mergedConfig[key];
			const configDefinition = Config.definitions[definition.type];

			// Set config value based on the provided definition and option
			config[key] = configDefinition(option, definition);
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

	// Check if the option is enabled for the subject
	static isEnabled(option, subject) {

		// Check for enable function
		if (typeof option === 'function') {
			return option(subject);
		} else {
			return option;
		}
	}
}

// Set config defitions
Config.definitions = {
	array(option, definition) {

		return Config.getArrayOption(option, definition.default);
	},
	boolean(option) {

		return Config.getBooleanOption(option);
	},
	enable(option) {

		return Config.getEnableOption(option);
	},
	function(option) {

		return Config.getFunctionOption(option);
	},
	number(option, definition) {

		return Config.getNumberOption(option, definition.default);
	},
	object(option, definition) {

		return Config.getObjectOption(option, definition.default);
	},
	set(option, definition) {

		return Config.getSetOption(option, definition.set, definition.default);
	},
	string(option) {

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