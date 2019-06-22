'use strict';

const { floor, random } = Math;

const byteMaxValue = 256; // Maximum byte value + 1, for uniform distribution

class Random {

	/**
	 * Generate non-cryptographically strong pseudo-random data as buffer
	 * @param {number} size
	 * @returns {Buffer}
	 */
	static randomBuffer(size) {

		const buffer = Buffer.allocUnsafe(size);

		let index = size;

		// Fill the result with random 0-255 values
		while (index--) {
			buffer[index] = floor(random() * byteMaxValue);
		}

		return buffer;
	}

	/**
	 * Generate non-cryptographically strong pseudo-random data as base64 string
	 * @param {number} size
	 * @returns {string}
	 */
	static randomBase64(size) {

		return Random.randomBuffer(size).toString('base64');
	}

	/**
	 * Generate non-cryptographically strong pseudo-random data as hex string
	 * @param {number} size
	 * @returns {string}
	 */
	static randomHex(size) {

		return Random.randomBuffer(size).toString('hex');
	}
}

module.exports = Random;