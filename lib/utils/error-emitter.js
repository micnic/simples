'use strict';

class ErrorEmitter {

	/**
	 * Emit safely errors to avoid fatal errors
	 * @param {EventEmitter} emitter
	 * @param {Error} error
	 */
	static emit(emitter, error) {

		// Check for error events listeners
		if (emitter.listeners('error').length) {
			emitter.emit('error', error);
		} else {
			process.stderr.write(`\n${error.stack}\n`);
		}
	}
}

module.exports = ErrorEmitter;