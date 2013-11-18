var chatSocket;
var echoSocket;
var string;

window.onload = function () {

	document.getElementById('get').onclick = function () {
		simples.ajax('get', {
			textinput: document.getElementById('textinput').value
		}).error(function (code, description) {
			document.getElementById('result').innerHTML = 'Error: ' + code + ' ' + description;
		}).success(function (response) {
			document.getElementById('result').innerHTML = 'Result:<br><br>' + response.replace(/\n/g, '<br>').replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
		});
	};

	document.getElementById('post').onclick = function () {
		var data = [1,2,3,4,5,6,7,8,9,0];

		/*if (document.getElementById('fileinput').files.length > 0) {
			data = document.getElementById('form');
		} else {
			data = {
				textinput: document.getElementById('textinput').value
			};
		}*/
		simples.ajax('post', data, 'post').error(function (code, description) {
			document.getElementById('result').innerHTML = 'Error: ' + code + ' ' + description;
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
			var string = '';
			var i = Number(document.getElementById('textinput').value);
			while (i--) {
				string += ' ';
			}
			echoSocket.send(string);
		}
	};

	document.getElementById('ws_file').onclick = function () {
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

		if (document.getElementById('fileinput').files[0]) {
			echoSocket.send(document.getElementById('fileinput').files[0]);
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