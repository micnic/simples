var echoSocket;

window.onload = function () {
	document.getElementById('get').onclick = function () {
		simples.ajax('get', {
			textinput: document.getElementById('textinput').value
		}).error(function (code, description) {
			document.getElementById('result').innerHTML = 'Error: ' + code + ' ' + description;
		}).progress(function () {
			document.getElementById('result').innerHTML = 'Loading...';
		}).success(function (response) {
			document.getElementById('result').innerHTML = 'Result:<br><br>' + response.replace(/\n/g, '<br>');
		});
	};

	document.getElementById('post').onclick = function () {
		simples.ajax('post', {
			fileinput: document.getElementById('fileinput').files[0],
			textinput: document.getElementById('textinput').value
		}, 'post').error(function (code, description) {
			document.getElementById('result').innerHTML = 'Error: ' + code + ' ' + description;
		}).progress(function () {
			document.getElementById('result').innerHTML = 'Loading...';
		}).success(function (response) {
			document.getElementById('result').innerHTML = 'Result:<br><br>' + response.replace(/\n/g, '<br>');
		});
	};

	document.getElementById('ws').onclick = function () {
		if (!echoSocket) {
			echoSocket = simples.ws('localhost:12345', ['echo'], true)
			.on('message', function (message) {
				document.getElementById('result').innerHTML = 'Result:<br><br>' + message;
				this.close();
			}).on('error', function (error) {
				console.log(error);
			}).on('close', function () {
				console.log('closed');
			});
		}

		echoSocket.send(document.getElementById('textinput').value);
	};

	document.getElementById('filebutton').onclick = function () {
		document.getElementById('fileinput').click();
	};
};