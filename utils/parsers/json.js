'use strict';

// Parse data with content-type application/json
var jsonParser = function (connection) {
	this.container = null;
	this.key = undefined;
	this.number = {
		digits: false,
		exponent: '',
		first: true,
		fraction: '',
		integer: '',
		point: false,
		power: false,
		sign: true
	};
	this.string = {
		escape: false,
		hex: '',
		unicode: false
	};
	this.result = null;
	this.stack = [];
	this.state = 0;
	this.value = undefined;
};

// Parse received data
jsonParser.prototype.parse = function (data) {

	var current = '',
		index = 0,
		that = this;

	// Expect false, null or true value
	function expectValue(string) {

		var buffer = that.value,
			length = string.length;

		// Buffer the received data
		while (current && buffer.length < length) {
			buffer += current;
			index++;
			current = data[index];
		}

		// Check if the value is false, null or true
		if (buffer === 'false') {
			that.value = false;
		} else if (buffer === 'null') {
			that.value = null;
		} else if (buffer === 'true') {
			that.value = true;
		}

		// Set the parser state or wait for more data
		if (buffer === string) {
			that.state = 0;
		} else if (buffer.length < length) {
			that.value = buffer;
		} else {
			stopParse();
		}
	}

	// Get the values of the previous container and key
	function popFromStack() {

		var pop = that.stack.pop();

		// Set the container to be the current value
		that.value = that.container;

		// If there is a previous state, make it current
		if (pop) {
			that.container = pop.container;
			that.key = pop.key;
		}
	}

	// Save the current container and key for future use
	function pushToStack() {
		if (that.container) {
			that.stack.push({
				container: that.container,
				key: that.key
			});
		}
	}

	// Determine what to expect next
	function getNextChar() {

		if (current === '"') { // string
			if (that.container && !Array.isArray(that.container) && that.key === undefined) {
				that.state = 6;
			} else {
				that.state = 1;
			}
			index++;
			current = data[index];
			that.value = '';
		} else if (current === ',' && that.container) {
			if (that.value === undefined) {
				stopParse();
			} else {
				if (Array.isArray(that.container)) {
					that.container.push(that.value);
					that.value = undefined;
				} else {
					if (that.key === undefined) {
						stopParse();
					} else {
						that.container[that.key] = that.value;
					}
				}
				index++;
				current = data[index];
			}
		} else if (current === ':' && !Array.isArray(that.container) && that.value !== undefined) {
			that.key = that.value;
			that.value = undefined;
			index++;
			current = data[index];
		} else if (current === '[') { // array
			pushToStack();
			that.container = [];
			index++;
			current = data[index];
		} else if (current === ']' && Array.isArray(that.container)) {
			if (that.value !== undefined) {
				that.container.push(that.value);
				that.value = undefined;
			}
			popFromStack();
			index++;
			current = data[index];
		} else if (current === 'f') { // false
			that.state = 3;
			that.value = '';
		} else if (current === 'n') { // null
			that.state = 4;
			that.value = '';
		} else if (current === 't') { // true
			that.state = 5;
			that.value = '';
		} else if (current === '{') { // object
			pushToStack();
			that.container = {};
			index++;
			current = data[index];
		} else if (current === '}') {
			if (that.key !== undefined && that.value !== undefined) {
				that.container[that.key] = that.value;
				that.key = undefined;
				that.value = undefined;
			}
			popFromStack();
			index++;
			current = data[index];
		} else if ('-0123456789'.indexOf(current) >= 0) { // number
			that.state = 2;
		} else {
			skipWhitespace();
		}
	}

	// Extract numeric data
	function parseNumber () {

		var charcode,
			digits = that.number.digits,
			exponent = that.number.exponent,
			first = that.number.first,
			fraction = that.number.fraction,
			integer = that.number.integer,
			point = that.number.point,
			power = that.number.power,
			sign = that.number.sign;

		// Get the "-" character if it is present
		if (sign && first && current === '-') {
			integer = '-';
			sign = false;
			index++;
			current = data[index];
		}

		// Get the first digit
		if (first) {
			charcode = current.charCodeAt(0);
			if (current === '0') {
				integer += '0';
				digits = false;
			} else if (charcode > 48 && charcode < 58) {
				integer += current;
				digits = true;
			} else {
				stopParse();
			}
			index++;
			current = data[index];
			first = false;
			point = true;
			power = true;
		}

		// Get the next digits, fraction or exponent
		while (current) {
			charcode = current.charCodeAt(0);
			if (digits && charcode > 47 && charcode < 58) {
				if (!fraction && !exponent) {
					integer += current;
				} else if (!exponent) {
					fraction += current;
					power = true;
				} else {
					exponent += current;
				}
			} else if (point && current === '.') {
				fraction = '.';
				digits = true;
				point = false;
				power = false;
			} else if (power && (current === 'e' || current === 'E')) {
				exponent = 'e';
				digits = true;
				point = false;
				power = false;
				sign = true;
			} else if (sign && (current === '+' || current === '-')) {
				exponent += current;
				sign = false;
			} else {
				break;
			}
			index++;
			current = data[index];
		}

		// Check for the end of the numeric value
		if (current) {
			if (fraction === '.' || exponent === 'e' || exponent === 'e-' || exponent === 'e+') {
				stopParse();
			} else {
				that.value = Number(integer + fraction + exponent);
				if (that.container) {
					that.state = 0;
				} else {
					that.state = 7;
				}
				that.number.digits = false;
				that.number.exponent = '';
				that.number.first = true;
				that.number.fraction = '';
				that.number.integer = '';
				that.number.point = false;
				that.number.power = false;
				that.number.sign = true;
			}
		} else if (current !== null) {
			that.number.digits = digits;
			that.number.exponent = exponent;
			that.number.first = first;
			that.number.fraction = fraction;
			that.number.integer = integer;
			that.number.point = point;
			that.number.power = power;
			that.number.sign = sign;
		}
	}

	// Extract string data
	function parseString() {

		var charcode = current.charCodeAt(0),
			escape = that.string.escape,
			hex = that.string.hex,
			unicode = that.string.unicode,
			value = that.value;

		// Get characters until an unescaped "
		while (current) {

			// Validate and append to the string
			if (current !== '"' && current !== '\\' && !escape && charcode > 31 && charcode !== 127) {
				value += current;
			} else if (current === '\\') {
				escape = true;
			} else if (escape) {
				if (unicode) {
					hex += current;
					if (hex.length === 4) {
						hex = parseInt(hex, 16);
						if (hex) {
							value += String.fromCharCode(hex);
							escape = false;
							unicode = false;
							hex = '';
						} else {
							stopParse();
						}
					}
				} else if (current === '"') {
					value += '"';
					escape = false;
				} else if (current === '\\') {
					value += '\\';
					escape = false;
				} else if (current === '/') {
					value += '/';
					escape = false;
				} else if (current === 'b') {
					value += '\b';
					escape = false;
				} else if (current === 'f') {
					value += '\f';
					escape = false;
				} else if (current === 'n') {
					value += '\n';
					escape = false;
				} else if (current === 'r') {
					value += '\r';
					escape = false;
				} else if (current === 't') {
					value += '\t';
					escape = false;
				} else if (current === 'u') {
					unicode = true;
				}
			} else if (charcode < 32 || charcode === 127) {
				stopParse();
			} else {
				break;
			}

			// Get next character
			index++;
			current = data[index];
			charcode = current.charCodeAt(0)
		}

		// Check for the end of the string
		if (current === '"') {
			if (that.container) {
				that.state = 0;
			} else {
				that.state = 7;
			}
			index++;
			current = data[index];
		} else {
			that.string.escape = escape;
			that.string.hex = hex;
			that.string.unicode = unicode;
		}

		// Save value
		that.value = value;
	}

	// Ignore whitespace
	function skipWhitespace() {
		if (current) {
			if ('\t\n\r '.indexOf(current) >= 0) {
				index++;
				current = data[index];
			} else {
				stopParse();
			}
		}
	}

	// Stop parsing because of an error
	function stopParse() {
		current = null;
		data = null;
		that.container = null;
		that.key = null;
		that.number = null;
		that.result = null;
		that.stack = null;
		that.state = -1;
		that.string = null;
		that.value = null;
	}

	// Check for final data chunk
	if (data === null) {
		if (that.state === 2) {
			if (this.number.fraction === '.' || this.number.exponent === 'e' || this.number.exponent === 'e-' || this.number.exponent === 'e+') {
				stopParse();
			} else {
				this.value = Number(this.number.integer + this.number.fraction + this.number.exponent);
			}
		}
		this.result = this.value;
	} else {
		current = data[index];
	}

	// Parse char by char in a loop
	while (current) {

		// Stop parsing if the data is invalid
		if (this.state === -1) {
			stopParse();
		}

		// Wait for a value
		if (this.state === 0) {
			getNextChar();
		}

		// Wait for a string value
		if (this.state === 1 || this.state === 6) {
			parseString();
		}

		// Wait for a number value
		if (this.state === 2) {
			parseNumber();
		}

		// Wait for a false value
		if (this.state === 3) {
			expectValue('false');
		}

		// Wait for a null value
		if (this.state === 4) {
			expectValue('null');
		}

		// Wait for a true value
		if (this.state === 5) {
			expectValue('true');
		}

		// Get some last whitespace
		if (this.state === 7) {
			skipWhitespace();
		}
	}
};

// Export the parser
module.exports = jsonParser;