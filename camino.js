(function() {
	var routes = {},
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

		call: function( route, context, data ) {
			context = context || undefined;

			/* I wish this stuff had worked...
			// 	find the sub pattern in the regex that matched the request URL
			// 	var end = route_str.indexOf( "|", rx.lastIndex );
			// 	var start = route_str.substr( 0, end ).lastIndexOf( "|" );

			// 	found it!
			// 	var sub = route_str.substring( start + 1, end );
			*/

			var sub;
			// loop through and try to find a route that matches the request
			for( r in routes ) {
				var rx = new RegExp( r, "g" );
				if( rx.test(route) === true ) {
					sub = r;
					break;
				}
			}

			if( sub === undefined ) {
				return { status: 404, success: false };
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
					rpar[routes[sub].params[ii]] = rxp[ii];
			}

			// check if the context requested is accepted by the callback
			if( routes[sub].context === undefined || routes[sub].context.indexOf( context ) !== -1 ) {
				return routes[sub].callback.call( null, context, rpar, data );
			}

			else {
				return { status: 405, success: false };
			}
		},

		listen: function( emitter ) {
			var that = this;

			if( node ) {
				var listener = emitter.addListener, event = "request";
				var callback = function( req, res ) {
					var body = "", url = require("url"), qs = require("querystring");

					req.on( "data", function( chunk ) {
						body += chunk;
					});

					req.on( "end", function() {
						body = qs.parse( body );
						var path = url.parse( req.url, true ).path;
						var exec = that.call( path, req.method, body );
						var status = exec.status;
						exec = JSON.stringify( exec );

						res.writeHead( status, {
							"Content-Length": exec.length,
							"Content-Type": "application/json"
						} );

						res.end( exec );
					});
				};
			}

			else {
				// listener is resolving fine in the browser though... help!
				var listener = emitter.addEventListener, event = "hashchange";
				var callback = function() {
					that.call( emitter.location.hash );
				};
			}


			listener.call( emitter, event, callback );
		}
	};


	if( typeof module !== "undefined" && module.exports ) {
		module.exports = new Camino;
		// since camino will likely be executed within the scope of a http/s
		// server, "this" will most likely be bound to that scope, so these
		// should be very safe defaults and reasonable assumptions
		node = true;
	}

	else {
		root.camino = new Camino;
	}
})();