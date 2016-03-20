
define(['variable','element','event'], function (copy,element,event) {

  'use strict';

  var api = {};
  for (var i in arguments) {
    for (var j in arguments[i]) {
      api[j] = arguments[i][j];
    }
  }

  return api;

});