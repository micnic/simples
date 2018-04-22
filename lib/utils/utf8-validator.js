'use strict';

const { bits } = require('simples/lib/utils/constants');

const x = null;

/* eslint-disable no-magic-numbers */
const states = [
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 000 - 00F
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 010 - 01F
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 020 - 02F
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 030 - 03F
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 040 - 04F
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 050 - 05F
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 060 - 06F
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 070 - 07F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 080 - 08F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 090 - 09F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 0A0 - 0AF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 0B0 - 0BF
	x, x, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 0C0 - 0CF
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 0D0 - 0DF
	2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 3, 3, // 0E0 - 0EF
	5, 6, 6, 6, 7, x, x, x, x, x, x, x, x, x, x, x, // 0F0 - 0FF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 100 - 10F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 110 - 11F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 120 - 12F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 130 - 13F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 140 - 14F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 150 - 15F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 160 - 16F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 170 - 17F
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 180 - 18F
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 190 - 19F
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 1A0 - 1AF
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 1B0 - 1BF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 1C0 - 1CF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 1D0 - 1DF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 1E0 - 1EF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 1F0 - 1FF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 200 - 20F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 210 - 21F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 220 - 22F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 230 - 23F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 240 - 24F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 250 - 25F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 260 - 26F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 270 - 27F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 280 - 28F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 290 - 29F
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 2A0 - 2AF
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 2B0 - 2BF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 2C0 - 2CF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 2D0 - 2DF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 2E0 - 2EF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 2F0 - 2FF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 300 - 30F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 310 - 31F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 320 - 32F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 330 - 33F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 340 - 34F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 350 - 35F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 360 - 36F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 370 - 37F
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 380 - 38F
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 390 - 39F
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 3A0 - 3AF
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 3B0 - 3BF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 3C0 - 3CF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 3D0 - 3DF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 3E0 - 3EF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 3F0 - 3FF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 400 - 40F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 410 - 41F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 420 - 42F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 430 - 43F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 440 - 44F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 450 - 45F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 460 - 46F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 470 - 47F
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 480 - 48F
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 490 - 49F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 4A0 - 4AF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 4B0 - 4BF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 4C0 - 4CF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 4D0 - 4DF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 4E0 - 4EF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 4F0 - 4FF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 500 - 50F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 510 - 51F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 520 - 52F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 530 - 53F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 540 - 54F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 550 - 55F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 560 - 56F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 570 - 57F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 580 - 58F
	3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, // 590 - 59F
	3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, // 5A0 - 5AF
	3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, // 5B0 - 5BF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 5C0 - 5CF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 5D0 - 5DF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 5E0 - 5EF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 5F0 - 5FF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 600 - 60F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 610 - 61F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 620 - 62F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 630 - 63F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 640 - 64F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 650 - 65F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 660 - 66F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 670 - 67F
	3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, // 680 - 68F
	3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, // 690 - 69F
	3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, // 6A0 - 6AF
	3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, // 6B0 - 6BF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 6C0 - 6CF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 6D0 - 6DF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 6E0 - 6EF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 6F0 - 6FF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 700 - 70F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 710 - 71F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 720 - 72F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 730 - 73F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 740 - 74F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 750 - 75F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 760 - 76F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 770 - 77F
	3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, // 780 - 78F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 790 - 79F
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 7A0 - 7AF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 7B0 - 7BF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 7C0 - 7CF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 7D0 - 7DF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, // 7E0 - 7EF
	x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x // 7F0 - 7FF
];
/* eslint-enable no-magic-numbers */

class Utf8Validator {

	// Check if buffer contains valid utf8 data
	static validate(buffer) {

		const length = buffer.length;

		let index = 0;
		let state = 0;
		let valid = true;

		// Loop through all buffer bytes
		while (valid && index < length) {

			const byte = buffer[index];

			// Get next state
			state = states[(state * bits) + byte];

			// Check for invalid state
			if (state === null) {
				valid = false;
			}

			// Get the index of the next byte
			index++;
		}

		// Check for buffer end and invalid state
		if (state !== 0) {
			valid = false;
		}

		return valid;
	}
}

module.exports = Utf8Validator;