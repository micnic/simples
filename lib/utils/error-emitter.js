'use strict';

class ErrorEmitter {

	// Emit safely errors to avoid fatal errors
	static emit(emitter, error) {

		// Check for error events listeners
		if (emitter.listeners('error').length) {
			emitter.emit('error', error);
		} else if (process.stderr.isTTY) {
			// eslint-disable-next-line
			console.error(`\n${error.stack}\n`);
		}
	}
}

module.exports = ErrorEmitter;