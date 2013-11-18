var simples = require('simples');
var client = require('./client');
var assert = require('assert');
//array of tests for one function

var options = {
    "port": 8080,
    "host": 'localhost',
    "headers": {
        "host": 'localhost'
    }
};

module.exports = function (callback) {

    var server = simples(8080);

    server.start(function () {
        client.http.get('/', options, function (response) {
            assert(response === '"/" Not Found', '404 route not found');
            fixedRoutes(server);
        })
    });

    server.log(function (connection) {
        return connection.headers;
    });
}

var iterator = function(count, neededCount, fn) {
    if(count == neededCount) {
        fn();
    }
}

var fixedRoutes = function (server) {

    var count = 0;
    var neededCount = 3;

    server.get('test', function(connection) {
        connection.end('testResponse');
    });

    server.get('test2', function(connection) {
        connection.end('test2Response');
    })

    client.http.get('/test', options, function (response) {
        ++count;
        assert(response === 'testResponse', 'test route not found');
        iterator(count, neededCount, testFn);
    });

    client.http.get('/test2', options, function (response) {
        ++count;
        assert(response === 'test2Response', 'test2 route not found');
        iterator(count, neededCount, testFn);
    });

    client.http.get('/inexistentRoute', options, function (response) {
        ++count;
        assert(response === '"/inexistentRoute" Not Found', 'test2 route not found');
        iterator(count, neededCount, testFn);
    });
}

var testFn = function(){
    console.log('test fn');
}