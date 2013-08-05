(function() {
	// route is a URL or a hash
	// callback is the function to execute when route is matched
	// context is a filter of some kind. GET-POST-PUT-DELETE on the server,
	// arbitrary in the browser
	var VERSION = '0.0.4',
		routes = {},
		root = this,
		emitter = null,
		route_str = '',
		ev = null;

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
		ev = 'hashchange';
		req = function() { return root.location.hash };
	}


	camino.fn = Camino.prototype = {
		route: function( route, callback, context ) {
			var params = [],
				matches,
				rx = /[@|%](\w+)/g;

			// extract var name(s) from route
			while( ( matches = rx.exec( route ) ) !== null )
				params.push( matches[1] );

			// replace var names with regexes
			route = route.replace( /@(\w+)/g, "(\\w+)" )
				// optional/required params could be rolled into one. if not,
				// the following needs to be fixed to accomodate params that
				// are not preceeded by a / (like hash routing)
				.replace( /\/%(\w+)/g, "/?(\\w+)*" )
				.replace( /\//g, "\\/" );

			// add route, params, context and callbacks to the stack
			route = '^' + route + '$';
			routes[route] = {
				callback: callback,
				params: params,
				context: context
			};

			// if camino has already started listening, append route to the
			// joined route string
			if( route_str.length > 0 )
				route_str += route;
		},

		// this function may have no practical use, but for testing/dev
		list: function() {
			var r = [], ii = 0;
			for( r[ii++] in routes );
			return r;
		},

		call: function( route ) {
			// var rx = new RegExp(route_str, "g");
			var sub;

			// I wish this stuff had worked...
			// 	find the sub pattern in the regex that matched the request URL
			// 	var end = route_str.indexOf( "|", rx.lastIndex );
			// 	var start = route_str.substr( 0, end ).lastIndexOf( "|" );

			// 	found it!
			// 	var sub = route_str.substring( start + 1, end );

			// loop through and try to find a route that matches the request
			for( r in routes ) {
				var rx = new RegExp( r, "g" );
				if( rx.test(route) === true ) {
					sub = r;
					break;
				}
			}

			if( sub === undefined ) {
				throw new Error( 'Route not found.' );
			}

			// grab params through regex, strip out the extra junk
			// wish we had some flags to make the output cleaner...
			var req_params = RegExp( sub, "g" ).exec( route );
			var par = {};

			if( req_params ) {
				// clean up the misc "info"
				delete req_params.index;
				delete req_params.input;
				req_params.shift();

				// merge the param names and values
				for( var ii = 0, l = req_params.length; ii < l; ++ii )
					par[routes[sub].params[ii]] = req_params[ii];
			}

			return routes[sub].callback.call(null, par);
		},

		listen: function() {
			// create the joined string of routes
			var r = [], ii = 0;
			for( r[ii++] in routes );
			route_str = r.join('|');

			var c = this;
			emitter( ev, function() {
				c.call( req() );
			} );
		}
	};
})();