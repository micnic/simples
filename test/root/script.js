window.onload = function () {
	document.getElementById('get').onclick = function () {
		simples.ajax('get', 'get', {
			textinput: document.getElementById('textinput').value
		}).error(function () {
			document.getElementById('result').innerHTML = 'Error';
		}).progress(function () {
			document.getElementById('result').innerHTML = 'Loading...';
		}).success(function (xhr) {
			document.getElementById('result').innerHTML = 'Result:<br><br>' + xhr.responseText.replace(/\n/g, '<br>');
		});
	};

	document.getElementById('post').onclick = function () {
		simples.ajax('post', 'post', {
			fileinput: document.getElementById('fileinput').files[0],
			textinput: document.getElementById('textinput').value
		}).error(function () {
			document.getElementById('result').innerHTML = 'Error';
		}).progress(function () {
			document.getElementById('result').innerHTML = 'Loading...';
		}).success(function (xhr) {
			document.getElementById('result').innerHTML = 'Result:<br><br>' + xhr.responseText.replace(/\n/g, '<br>');
		});
	};

	document.getElementById('ws').onclick = function () {
		simples.ws('localhost', [], true).send(document.getElementById('textinput').value).on('message', function (message) {
			document.getElementById('result').innerHTML = 'Result:<br><br>' + message;
		});
	};

	document.getElementById('filebutton').onclick = function () {
		document.getElementById('fileinput').click();
	};
};