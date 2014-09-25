(function() {
	var request = require('request');
	var async = require('async');

	async.parallel([

		function() {
			request.get('http://localhost:24601/api/sawyer/brown', function (error, response, body) {
				if (!error && response.statusCode == 200) {
					console.log(body) // Print the google web page.
				}
			})
		},
		function() {
			request.put('http://localhost:24601/api/ross/koskan/queaf', function(e, r, b) {
				console.log(b);
			})
		},
		function() {
			request.del('http://localhost:24601/api/ross/slcvb/loser', function(e, r, b) {
				console.log(b);
			})
		},

		function() {
			// setTimeout(function() {
				request.get('http://localhost:24601/api/ross/infuse/mountain', function(e, r, b) {
					console.log(b);
				})
			// });
		},
		function() {
			request.put('http://localhost:24601/api/ross/consultnet/perv', function(e, r, b) {
				console.log(b);
			})
		},
		function() {
			request.del('http://localhost:24601/api/ross/candeo/rossome', function(e, r, b) {
				console.log(b);
			})
		},
		function() {
			request.get('http://localhost:24601/api/sawyer/brown', function (error, response, body) {
				if (!error && response.statusCode == 200) {
					console.log(body) // Print the google web page.
				}
			})
		},
		function() {
			request.put('http://localhost:24601/api/sawyer/brown', function (error, response, body) {
				if (!error && response.statusCode == 200) {
					console.log(body) // Print the google web page.
				}
			})
		},
		function() {
			request.del('http://localhost:24601/api/ross/owner', function(e, r, b) {
				console.log(b);
			})
		},
		function() {
			// setTimeout(function() {
				request.get('http://localhost:24601/api/ross/operator/bobcat', function(e, r, b) {
					console.log(b);
				})
			// }, 5000);
		},
		function() {
			request.put('http://localhost:24601/api/ross/chevy/duramax', function(e, r, b) {
				console.log(b);
			})
		},
		function() {
			request.get('http://localhost:24601/api/ross/allison/3500hd', function(e, r, b) {
				console.log(b);
			})
		}
	])
})();