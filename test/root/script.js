var chatSocket;
var echoSocket;
var string;

window.onload = function () {

	var radios = document.getElementsByName('size');

	function setSum() {
		var sum = 0;
		string = '';
		for (var j = 0; j < radios.length; j++) {
			if (radios[j].checked) {
				sum += Number(radios[j].value);
			}
		}
		document.getElementById('sum').innerHTML = sum;
		while (sum--) {
			string += ' ';
		}
	}

	for (var i = 0; i < radios.length; i++) {
		radios[i].onchange = setSum;
	}

	setSum();

	document.getElementById('get').onclick = function () {
		simples.ajax('get#hash', {
			textinput: document.getElementById('textinput').value
		}).error(function (code, description) {
			document.getElementById('result').innerHTML = 'Error: ' + code + ' ' + description;
		}).progress(function () {
			document.getElementById('result').innerHTML = 'Loading...';
		}).success(function (response) {
			document.getElementById('result').innerHTML = 'Result:<br><br>' + response.replace(/\n/g, '<br>').replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
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
			document.getElementById('result').innerHTML = 'Result:<br><br>' + response.replace(/\n/g, '<br>').replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
		});
	};

	document.getElementById('ws').onclick = function () {
		if (!echoSocket) {
			echoSocket = simples.ws(window.location.host + '/echo', ['echo'], true)
				.on('message', function (message) {
					if (document.getElementsByName('type')[0].checked) {
						document.getElementById('result').innerHTML = 'Result:<br><br>' + message;
					} else {
						document.getElementById('result').innerHTML = 'Result:<br><br>' + message.length + ' bytes received';
					}
				}).on('error', function (error) {
					console.log(error);
				}).on('close', function () {
					console.log('closed');
				});
		}

		if (document.getElementsByName('type')[0].checked) {
			echoSocket.send(document.getElementById('textinput').value);
		} else {
			echoSocket.send(string);
		}
	};

	document.getElementById('filebutton').onclick = function () {
		document.getElementById('fileinput').click();
	};

	chatSocket = simples.ws('/chat', ['chat'])
		.on('users', function (users) {
			document.getElementById('users').innerHTML = users.join('<br>');
		})
		.on('message', function (message) {
			document.getElementById('messages').innerHTML += message + '<br>';
		})

	function sendMessage() {
		var data = document.getElementById('messageContainer').value;
		document.getElementById('messageContainer').value = '';
		document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight * 2;
		document.getElementById('messageContainer').focus();
		if (data) {
			chatSocket.send('message', data);
		}
	}

	document.getElementById('messageSender').onclick = sendMessage;

	document.getElementById('messageContainer').onkeydown = function (event) {
		if (event.which === 13 && event.ctrlKey) {
			sendMessage();
		}
	}

	window.onkeydown = function (event) {
		if (event.which === 13 && event.shiftKey) {
			var name = prompt('Which name do you want?');
			if (name) {
				chatSocket.send('changeName', name);
			}
		}
	}
};