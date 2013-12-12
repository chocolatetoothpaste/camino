(function() {
	var routes = {},
		route_str = [],
		root = this,
		options = {},
		node = false;

	function Camino() { };

	if( typeof module !== "undefined" && module.exports ) {
		// inheritance stuff goes in here so it doesn't gum up the browser
		var util = require("util"),
			events = require("events");

		// keeping the constructor clean for the browser
		events.EventEmitter.call( Camino );

		// inherit methods from events.EventEmitter
		util.inherits(Camino, events.EventEmitter);


		/**
		 * Attach the appropriate listener to the emitting object, and wait for
		 * an event.
		 */

		Camino.prototype.listen = function( emitter, responder ) {
			emitter.addListener( 'request', (function( req, res ) {
				options.responder = responder || res;

				var qs = require( "qs" ),
					url = require( "url" ).parse( req.url );

				// grab the request body, if applicable
				req.data = "";
				req.on( "data", function( chunk ) {
					req.data += chunk;
				});

				req.on( "end", (function() {
					// augment the request object
					req.data = qs.parse( req.data );
					req.body = req.data;
					req.request = url.pathname;
					req.context = req.method;
					req.query = qs.parse( url.query );

					// start event listener
					this.error( res );

					// fire off the router
					this.exec( req );

				}).bind( this ) );

			}).bind( this ) );
		};

		module.exports = new Camino;
		node = true;
	}

	else {


		/**
		 * Shim for browsers
		 */

		Camino.prototype.emit = function(event) {
			root.dispatchEvent( new Event(event) );
		}

		/**
		 * Attach the appropriate listener to the emitting object, and wait for
		 * an event.
		 */

		Camino.prototype.listen = function( emitter, responder ) {
			// if( typeof emitter.history.pushStaten !== "undefined" ) {

			// }

			// else {
			{
				options.responder = responder;
				emitter.addEventListener( "hashchange", function() {
					// augment location object
					emitter.location.request = emitter.location.hash;

					this.exec( emitter.location );
				}.bind(this) );
			}
		};

		root.camino = new Camino;
	}


	/**
	 * Define a route to listen for requests
	 */

	Camino.prototype.route = function( route, opt, cb ) {
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
		route_str.push(route);

		// add the route and it's crap to the stack
		var ret = {
			callback: cb,
			params: params
		};

		// if( typeof opt.responder !== "undefined" )
			ret.responder = opt.responder || null;

		// if( typeof opt.context !== "undefined" )
			ret.context = opt.context || [];

		routes[route] = ret;
	};


	/**
	 * list all registered routes
	 * this function may have no practical use, but for testing/dev
	 */

	Camino.prototype.list = function() {
		var r = [], ii = 0;
		for( i in routes )
			r.push(i);

		return r;
	};


	/**
	 * Eexecute the user callback associated with a route
	 */

	Camino.prototype.exec = function( map ) {
		// placeholder for a sub-pattern match to the route
		var match, sub;

		// loop through and try to find a route that matches the request
		// I wish there was a more efficient way to do this
		for( sub in routes ) {
			match = RegExp( sub, 'g' ).exec( map.request );
			if( match !== null )
				break;
		}

		// if a matching route was found
		if( ! match ) {
			this.emit( 'error', {
				status: 404,
				success: false,
				message: 'Resource not found'
			} );

			return false;
		}

		// this gets referenced a lot, so might as well make it a bit prettier
		var route = routes[sub];

		// check if the context requested is accepted by the callback
		if( route.context > 0 && route.context.indexOf( map.context ) === -1 ) {
			this.emit( 'error', {
				status: 405,
				success: false,
				message: 'Method not allowed'
			} );

			return false;
		}

		// clean up the misc data from the regexp match
		// wish there were some flags to make the output cleaner...
		delete match.index;
		delete match.input;
		match.shift();

		map.params = {};

		// merge the param names and values
		for( var ii = 0, l = match.length; ii < l; ++ii )
			// optional params are captured with an undefined value
			// so check that param has a value (or improve the regex)
			if( typeof match[ii] !== 'undefined' )
				map.params[route.params[ii]] = match[ii];

		// assign the responder, either custom or global
		var responder = route.responder || options.responder;

		// execute the user callback, passing request data and responder
		route.callback.call( null, map, responder );
	};


	/**
	 * Add a basic error response handler, augmentation is encouraged
	 */

	Camino.prototype.error = function( response ) {
		this.on( 'error', function( data ) {
			response.writeHead( data.status, {
				"Content-Type": "application/json"
			} );
			response.end( JSON.stringify( data ) );
		});
	};

})();