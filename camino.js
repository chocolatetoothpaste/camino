(function() {
	// route is a URL or a hash
	// callback is the function to execute when route is matched
	// context is a filter of some kind. GET-POST-PUT-DELETE on the server,
	// arbitrary in the browser
	var routes = {},
		root = this,
		emitter = null,
		event = null;

	function Camino() { };
	function camino() { return new Camino; };

	if( typeof module !== 'undefined' && module.exports ) {
		module.exports = camino;
		// set listener for http/s server
		// emitter = root.on ?
	}

	else {
		root.camino = camino;
		emitter = root.addEventListener;
		event = 'hashchange';
		req = function() { return root.location.hash };
	}


	camino.fn = Camino.prototype = {
		route: function( route, callback, context ) {
			routes[route] = { callback: callback, context: context };
		},

		// this function may have no practical use, but for testing/dev it's here
		list: function() {
			var r = [], ii = 0;
			for( r[ii++] in routes );
			return r;
		},

		call: function( route, args ) {
			args = args || [];

			console.log("route: " + route);

			if( routes[route] !== undefined )
			{
				return routes[route].callback.apply(null, args);
			}
			// else
			// 	throw new Error( 'Route not found.' );
		},

		listen: function() {
			var c = this;
			emitter( event, function() {
				c.call( req() );
			} );
		}
	};
})();