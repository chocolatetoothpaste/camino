var camino = require('../dist/camino-server');

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

camino.route('/api/ross/@company/%name', function(req, res) {
	res.write(JSON.stringify({ req: req.request, params: req.params }));
	res.end();
});

camino.route('/api/sawyer/brown', {methods: ['GET', 'PUT']}, function(req, res) {
	console.log('Files:', req.files);
	res.end(JSON.stringify({ "success": true, "data": ["Soybean"] }));
});

var http = require('http');

var server = http.createServer().listen(24601, '127.0.0.1');

camino.listen(server);