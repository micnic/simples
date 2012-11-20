window.onload = function () {
	document.getElementById('get').onclick = function () {
		var xhr = XMLHttpRequest();
		xhr.open('GET', '/get?textinput=' + document.getElementById('textinput').value, true);
		xhr.onreadystatechange = function() {
			if(xhr.readyState === 4 && xhr.status === 200) {
				document.getElementById('result').innerHTML = 'Result:<br><br>' + xhr.responseText.replace(/\n/g, '<br>');
			}
		}
		xhr.send();
	};

	document.getElementById('post').onclick = function () {
		var xhr = XMLHttpRequest();
		xhr.open('POST', '/post', true);
		var params;
		if (document.getElementById('fileinput').files[0]) {
			params = new FormData();
			params.append('fileinput', document.getElementById('fileinput').files[0]);
		} else {
			params = 'textinput=' + document.getElementById('textinput').value;
		}
		
		xhr.onreadystatechange = function() {
			if(xhr.readyState === 4 && xhr.status === 200) {
				document.getElementById('result').innerHTML = 'Result:<br><br>' + xhr.responseText.replace(/\n/g, '<br>');
			}
		}
		xhr.send(params);
	};

	document.getElementById('ws').onclick = function () {
		var socket = WebSocket('ws://localhost/', 'echo');
		socket.onmessage = function (message) {
			document.getElementById('result').innerHTML = 'Result:<br><br>' + message.data;
		};
		socket.onopen = function() {
			socket.send(document.getElementById('textinput').value);
		};
	};

	document.getElementById('filebutton').onclick = function () {
		document.getElementById('fileinput').click();
	};
};