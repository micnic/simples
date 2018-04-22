'use strict';

const { byteMaxValue } = require('simples/lib/utils/constants');

class Random {

	// Generate non-cryptographically strong pseudo-random data as buffer
	static randomBuffer(size) {

		const buffer = Buffer.allocUnsafe(size);

		// Fill the result with random 0-255 values
		while (size) {
			buffer[size] = Math.round(Math.random() * byteMaxValue);
			size--;
		}

		return buffer;
	}

	// Generate non-cryptographically strong pseudo-random data as base64 string
	static randomBase64(size) {

		return Random.randomBuffer(size).toString('base64');
	}
}

module.exports = Random;