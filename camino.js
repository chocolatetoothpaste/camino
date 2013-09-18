(function() {
	var routes = {},
		root = this,
		node = false;
		// route_str = '';

	function Camino() { };
	function camino() { return new Camino; };

	if( typeof module !== 'undefined' && module.exports ) {
		module.exports = camino;
		// since camino will likely be executed within the scope of a http/s
		// server, "this" will most likely be bound to that scope, so these
		// should be very safe defaults and reasonable assumptions
		node = true;
	}

	else {
		root.camino = camino;
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
			// optional/required params could be rolled into one. if not,
			// the following needs to be fixed to accomodate optional params
			// that are not preceeded by a / (like hash routing)
			route = route.replace( /@(\w+)/g, "(\\w+)" )
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
			// if( route_str.length > 0 )
			// 	route_str += route;
		},

		// this function may have no practical use, but for testing/dev
		list: function() {
			var r = [], ii = 0;
			for( r[ii++] in routes );
			return r;
		},

		call: function( route, context ) {
			context = context || undefined;
			// var rx = new RegExp(route_str, "g");
			var sub;

			/* I wish this stuff had worked...
			// 	find the sub pattern in the regex that matched the request URL
			// 	var end = route_str.indexOf( "|", rx.lastIndex );
			// 	var start = route_str.substr( 0, end ).lastIndexOf( "|" );

			// 	found it!
			// 	var sub = route_str.substring( start + 1, end );
			*/

			// loop through and try to find a route that matches the request
			for( r in routes ) {
				var rx = new RegExp( r, "g" );
				if( rx.test(route) === true ) {
					sub = r;
					break;
				}
			}

			if( sub === undefined ) {
				console.log( 'Route not found: ' + route );
				return;
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

			// check if the context requested is accepted by the callback
			if( routes[sub].context && context ) {
				if( routes[sub].context.indexOf( context ) !== -1 ) {
					return routes[sub].callback.call(null, par);
				}

				else {
					// this is just a place holder, not acceptable for prod
					console.log('method not allowed: ' + context);
				}
			}

			else {
				return routes[sub].callback.call(null, par);
			}
		},

		listen: function( emitter ) {
			var that = this;

			if( node ) {
				emitter.addListener( "request", function( req, res ) {
					var url = require( 'url' );
					that.call( url.parse( req.url, true ).path, req.method );
					res.end();
				});
			}

			else {
				emitter.addEventListener( "hashchange", function() {
					that.call( emitter.location.hash );
				});
			}

			// var on = ( node ? emitter.on : emitter.addEventListener );
			// var e = ( node ? "request" : "hashchange" );

			// var n = emitter.on;

			// n( "request", function(req, res) {
			// 	// console.log(node);
			// 	// if( node ) {
			// 		console.log('served')
			// 	// 	var url = require('url');
			// 	// 	that.call(url.parse( req.url, true ));
			// 	// 	res.end('called!')
			// 	// }

			// 	// else {
			// 	// 	that.call(emitter.location.hash);
			// 	// }
			// })
		}
	};
})();