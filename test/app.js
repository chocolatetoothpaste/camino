var camino = require('../dist/camino-server');
var util = require('util');


// log all events that camino emits:
///
// Object.keys(camino.event).forEach(function(k) {
// 	camino.on(camino.event[k], function(data) {
// 		console.log(camino.event[k], ": ", data);
// 	});
// });
//*/


camino.on('error', function(err, req) {
	var data = JSON.stringify({
		success: false,
		status: err.status,
		error: err.message
	});

	req.response.writeHead( err.status, {
		"Content-Type": "application/json",
		"Content-Length": data.length
	} );

	req.response.end( data );

	req = null;
});


camino.route('/', function(req) {
	var res = req.response;
	delete req.request;
	delete req.response;
	res.writeHead(200, { 'Content-Type': 'application/json'});
	res.write(JSON.stringify({ page: 'index', data: req }));
	res.end();
});

camino.route('/api/user/%user_id', function(req) {
	var res = req.response;
	delete req.request;
	delete req.response;
	res.writeHead(200, { 'Content-Type': 'application/json'});
	res.write(JSON.stringify({ data: req }));
	res.end();
});

camino.route('/api/user/@user_id/messages/%id', function(req) {
	var res = req.response;
	delete req.request;
	delete req.response;
	res.writeHead(200, { 'Content-Type': 'application/json'});
	res.write(JSON.stringify({ data: req }));
	res.end();
});

camino.route('/api/user/auth', function(req) {
	var res = req.response;
	delete req.request;
	delete req.response;
	res.writeHead(200, { 'Content-Type': 'application/json'});
	res.write(JSON.stringify({ data: req }));
	res.end();
});

camino.route('/api/user/type', function(req) {
	var res = req.response;
	delete req.request;
	delete req.response;
	res.writeHead(200, { 'Content-Type': 'application/json'});
	res.write(JSON.stringify({ data: req }));
	res.end();
});

camino.route('/api/appointment/%id', function(req) {
	var res = req.response;
	delete req.request;
	delete req.response;
	res.writeHead(200, { 'Content-Type': 'application/json'});
	res.write(JSON.stringify({ data: req }));
	res.end();
});

camino.route('/api/user/@id/data', function(req) {
	var res = req.response;
	delete req.request;
	delete req.response;
	res.writeHead(200, { 'Content-Type': 'application/json'});
	res.write(JSON.stringify({ data: req }));
	res.end();
});

camino.route('/api/sawyer/brown', {methods: ['GET', 'PUT']}, function(req) {
	var res = req.response;
	delete req.request;
	delete req.response;
	res.writeHead(200, { 'Content-Type': 'application/json'});
	res.write(JSON.stringify({ data: req }));
	res.end();
});

camino.route('/api/message/@id', function(req) {
	var res = req.response;
	delete req.request;
	delete req.response;
	res.writeHead(200, { 'Content-Type': 'application/json'});
	res.write(JSON.stringify({ data: req }));
	res.end();
});


var http = require('http');

var server = http.createServer().listen(24601, '127.0.0.1');

camino.listen(server);

console.log('Camino listening on port', 24601);