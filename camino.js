(function() {
	var routes = {},
		route_str = "",
		root = this,
		node = false;

	function Camino() { };

	Camino.prototype = {
		route: function( route, callback, context ) {
			var params = [],
				matches,
				rx = /[@|%](\w+)/g;

			// extract var name(s) from route
			while( ( matches = rx.exec( route ) ) !== null )
				params.push( matches[1] );

			// replace var names with regexes
			route = route.replace( /@(\w+)/g, "(\\w+)" )
				.replace( /\/%(\w+)/g, "(?:/?|/(\\w+))" )
				.replace( /\//g, "\\/" );

			// complete and isolate the route
			route = [ "^", route, "$" ].join("");

			// add the route and it's crap to the stack
			routes[route] = {
				callback: callback,
				params: params,
				context: context
			};

			// if camino has already started listening, append route to the
			// joined route string
			// if( route_str.length > 0 )
			// 	route_str.concat("(", route, ")");
		},

		// this function may have no practical use, but for testing/dev
		// list all registered routes
		list: function() {
			var r = [], ii = 0;
			for( r[ii++] in routes );
			return r;
		},

		// execute the callback associated with a route
		exec: function( route, context, data, callback ) {
			context = context || undefined;

			/* I wish this stuff had worked...
			// 	find the sub pattern in the regex that matched the request URL
			// 	var end = route_str.indexOf( "|", rx.lastIndex );
			// 	var start = route_str.substr( 0, end ).lastIndexOf( "|" );

			// 	found it!
			// 	var sub = route_str.substring( start + 1, end );
			*/

			// placeholder for a sub-pattern match to the route
			var sub;

			// loop through and try to find a route that matches the request
			for( var r in routes ) {
				var rx = new RegExp( r, "g" );
				if( rx.test(route) === true ) {
					sub = r;
					break;
				}
			}

			if( sub === undefined ) {
				return callback( { status: 404, success: false } );
			}

			// grab params through regex, strip out the extra junk
			// wish we had some flags to make the output cleaner...
			var rxp = RegExp( sub, "g" ).exec( route );
			var rpar = {};

			if( rxp ) {
				// clean up the misc "info"
				delete rxp.index;
				delete rxp.input;
				rxp.shift();

				// merge the param names and values
				for( var ii = 0, l = rxp.length; ii < l; ++ii )
					// the optional param regex causes issues with params list,
					// so check that a param has a value (or improve the regex)
					if( typeof rxp[ii] !== "undefined" )
						rpar[routes[sub].params[ii]] = rxp[ii];
			}

			// check if the context requested is accepted by the callback
			if( typeof routes[sub].context === "undefined"
			|| routes[sub].context.indexOf( context ) !== -1 ) {
				return routes[sub].callback.call( null, context, rpar, data, callback );
			}

			else {
				return callback( { status: 405, success: false } );
			}
		},

		/**
		 * Attach the appropriate listener to the emitting object, and wait for
		 * an event.
		 */

		listen: function( emitter ) {
			var self = this;

			// var r = [], ii = 0;
			// for( r[ii++] in routes );
			// route_str = "(" + r.join(")|(") + ")";

			if( node ) {
				var listener = emitter.addListener, event = "request";
				var callback = function( req, res ) {
					var qs = require( "querystring" ), url = require( "url" ),
						body = "", path = url.parse( req.url, true ).path;

					// grab the request body, if applicable
					req.on( "data", function( chunk ) {
						body += chunk;
					});

					req.on( "end", function() {
						body = qs.parse( body );
						// I hate using a callback here, it is SOOOO specific
						// to the response object from the http server...
						self.exec( path, req.method, body, function( data ) {
							var status = data.status;
							data = JSON.stringify( data );

							res.writeHead( status, {
								"Content-Length": data.length,
								"Content-Type": "application/json"
							} );

							res.end(data);
						} );
					} );
				};
			}

			else {
				// listener is resolving fine in the browser though... help!
				var listener = emitter.addEventListener, event = "hashchange";
				var callback = function() {
					self.exec( emitter.location.hash );
				};
			}

			listener.call( emitter, event, callback );
		}
	};


	if( typeof module !== "undefined" && module.exports ) {
		module.exports = new Camino;
		node = true;
	}

	else {
		root.camino = new Camino;
	}
})();