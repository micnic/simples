var state = 0;
var params = {};
var key = '';
var value = '';
var index;

function addkey(key, value) {
	if (key || value) {
		if (!params[key]) {
			params[key] = value;
		} else if (!Array.isArray(params[key])) {
			params[key] = [params[key], value];
		} else if (params[key].indexOf(value) < 0) {
			params[key].push(value);
		}
	}
}

function parse(chunk) {
	index = 0;
	while (chunk[index]) {
		if (state === 0) { // wait for key
			while (chunk[index] && chunk[index] !== '=' && chunk[index] !== '&') {
				key += chunk[index];
				index++;
			}

			if (chunk[index] === '=' || chunk[index] === '&') {
				state = 1;
				index++;
			}
		}

		if (state === 1) { // wait for value
			while (chunk[index] && chunk[index] !== '&') {
				value += chunk[index];
				index++;
			}

			if (chunk[index] === '&') {
				state = 0;
				index++;
				key = decodeURIComponent(key);
				value = decodeURIComponent(value);

				addkey(key, value);
				
				key = '';
				value = '';
			}
		}
	}
	
}

parse('a=1');
parse('&b=2');
addkey(key, value);

console.log(params);