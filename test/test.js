var camino = require('../dist/camino-all.js');
var util = require('util');

exports.route = function(test) {
	// camino.listen(camino);
	// camino.route('/test/url', function() {});

	// test.equal(util.inspect(camino.listeners('request')), '[ [Function] ]');

	// camino.emit('request', {url: '/test'}, {asdf: 'grh'});



	// test.ok(true);

	test.done();
};

exports.endToEnd = function(test) {
	// var camino = require('../dist/camino-server');

	camino.on('match', function(match) {
		console.log('Event: match', match.route)
	});

	camino.on('error', function() {
		console.log('Event: error')
	});

	camino.on('exec', function() {
		console.log('Event: exec')
	});

	camino.on('request', function() {
		console.log('Event: request')
	});

	camino.on('route', function() {
		console.log('Event: route')
	});

	camino.route('/test/url/@param', function(req, res) {
		res.write(JSON.stringify({ req: req.request, params: req.params }));
		res.end();
	});

	camino.route('/api/sawyer/brown', {methods: ['GET', 'PUT']}, function(req, res) {
		res.writeHead(200, { 'Content-Type': 'application/json'})
		res.end(JSON.stringify({ "success": true, "data": ["Soybean"] }));
	});

	camino.route('/api/upload', {methods: ['POST']}, function(req, res) {
		res.writeHead(200, { 'Content-Type': 'image/png'})
		res.end(req.files.image);
	});

	var http = require('http');
	var port = 7357;
	var url = '127.0.0.1';

	var server = http.createServer().listen(port, url);
	// server.close();

	camino.listen(server);

	var options = {
		hostname: url,
		port: port,
		path: '/test/url/23',
		method: 'POST'
	};

	var req = http.request(options, function(res) {
		// console.log(res);
		console.log('STATUS: ' + res.statusCode);
		// console.log('HEADERS: ' + JSON.stringify(res.headers));
		res.setEncoding('utf8');
		res.on('data', function (chunk) {
			test.equal(chunk, '{"req":"/test/url/23","params":{"param":"23"}}')
		});
	});

	// req.write('data\n');

	req.end();

	test.done();
};