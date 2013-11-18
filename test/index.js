// var instanceStart = require('./instance.start.js');
var assert = require('assert');

//TODO make file parser, witch will create this array.

var tests = [
    './instance.start.js',
];

var executeTest = function(){

};

(function () {

    var temp = require(tests[0]);

    temp(function(){});
//
//    temp.forEach(function (fn, index) {
//        fn(function (err, params) {
//
//        });
//    })
//    console.log(temp);
})()
