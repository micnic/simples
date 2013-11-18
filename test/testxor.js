var utils = require('../utils/utils');

var b1 = new Buffer(15);
var b2 = new Buffer(15);
var m = new Buffer(4);

function xor(data, mask) {
	var index = data.length;

	while (index--) {
		data[index] ^= mask[index % 4];
	}

	return data;
};

b2.copy(b1);

console.log(b1);

console.log(utils.xor(b1, m));

console.log(b1);

console.log(b2);

xor(b2, m);

console.log(b2);