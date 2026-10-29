var express = require('express');
var os = require('os');
var FibonacciService = require('./Services/FibonacciService')

var app = express();

// Indica qué VM atendió la petición (útil para ver el reparto del balanceador)
app.use(function (req, res, next) {
  res.set('X-Served-By', os.hostname());
  next();
});

app.get('/fibonacci/:nthIn', function (req, res) {
  var nth = FibonacciService.getNthNumberInSequence(parseInt(req.params.nthIn))
  res.send('The answer is ' + nth);
});

app.get('/', function (req, res) {
  res.send('Hello World');
});

app.listen(3000, function () {
  console.log('Fibonacci App listening on port 3000!');
});
