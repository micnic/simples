function generate() {
	var chrs = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
		count = 8,
		value = '';

	// Append a random character to the name
	while (count--) {
		value += chrs.charAt(Math.random() * 62 | 0);
	}

	return value;
}

document.addEventListener('DOMContentLoaded', function () {

	var username = document.getElementById('username'),
		password = document.getElementById('password'),
		login = document.getElementById('login'),
		loginForm = document.getElementById('login-form');

	login.addEventListener('click', function () {
		if (!username.value) {
			username.focus();
		} else if (!password.value) {
			password.focus();
		} else {
			loginForm.submit();
		}
	});
});