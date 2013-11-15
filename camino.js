(function() {
	var routes = {},
		root = this,
		options = {},
		node = false;

	function Camino() { };

	Camino.prototype = {
		route: function( route, opt, cb ) {
			var params = [],
				matches,
				rx = /[@|%](\w+)/g;

			if( typeof opt === "function" ) {
				cb = opt;
				opt = {};
			}

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
			var ret = {
				callback: cb,
				params: params
			};

			if( typeof opt.responder !== "undefined" )
				ret.responder = opt.responder;

			if( typeof opt.context !== "undefined" )
				ret.context = opt.context;

			routes[route] = ret;
		},

		// this function may have no practical use, but for testing/dev
		// list all registered routes
		list: function() {
			var r = [], ii = 0;
			for( i in routes )
				r.push(routes[i]);

			return r;
		},

		// execute the callback associated with a route
		exec: function( map ) {
			// placeholder for a sub-pattern match to the route
			var sub;

			// loop through and try to find a route that matches the request
			for( var r in routes ) {
				var rx = new RegExp( r, "g" );
				if( rx.test( map.request ) === true ) {
					sub = r;
					break;
				}
			}

			if( typeof sub === "undefined" ) {
				return { status: 404, success: false };
			}

			// grab params through regex, strip out the extra junk
			// wish we had some flags to make the output cleaner...
			var rxp = RegExp( sub, "g" ).exec( map.request );
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

			// add the newly capture params to the route map :)
			map.params = rpar;

			var responder = routes[sub].responder || options.responder;

			// check if the context requested is accepted by the callback
			if( typeof routes[sub].context === "undefined"
			|| routes[sub].context.indexOf( map.context ) !== -1 ) {
				routes[sub].callback.call( null, map, responder );
			}

			else {
				return { status: 405, success: false };
			}
		},

		/**
		 * Attach the appropriate listener to the emitting object, and wait for
		 * an event.
		 */

		listen: function( emitter, responder ) {
			var self = this, callback, listener;

			if( node ) {
				listener = emitter.addListener, event = "request";
				callback = function( req, res ) {
					options.responder = responder || res;

					var qs = require( "qs" ),
						url = require( "url" ).parse( req.url );

					// grab the request body, if applicable
					req.body = "";
					req.on( "data", function( chunk ) {
						req.body += chunk;
					});

					req.on( "end", function() {
						// augment the request object
						req.body = qs.parse( req.body );
						req.request = url.pathname;
						req.context = req.method;
						req.query = qs.parse( url.query );

						// console.log(req);

						var ret = self.exec( req );

						if( typeof ret !== "undefined" && ret.success === false ) {
							res.writeHead( ret.status, {
								"Content-Type": "application/json"
							} );
							res.end( JSON.stringify( ret ) );
						}
					} );
				};
			}

			else {
				options.responder = responder;
				listener = emitter.addEventListener, event = "hashchange";
				callback = function() {
					emitter.location.request = emitter.location.hash;
					self.exec( emitter.location );
				};
			}

			// fire whichever event to whatever listener
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