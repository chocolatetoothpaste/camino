(function() {
	var routes = {},
		root = this,
		options = {};

	function Camino() { };

	// server stuff
	if( typeof module !== "undefined" && module.exports ) {
		var util = require("util"),
			events = require("events");

		// execute constructor on camino object
		events.EventEmitter.call( Camino );

		// inherit methods from events.EventEmitter
		util.inherits(Camino, events.EventEmitter);


		/**
		 * Attach the appropriate listener to the emitting object, and wait for
		 * an event.
		 */

		Camino.prototype.listen = function( emitter, responder ) {
			emitter.addListener( 'request', ( function( req, res ) {
				options.responder = responder || res;

				var qs = require( "qs" ),
					url = require( "url" ).parse( req.url );

				// grab the request body, if applicable
				req.data = "";
				req.on( "data", function( chunk ) {
					req.data += chunk;
				});

				req.on( "end", ( function() {
					// augment the request object
					req.data = qs.parse( req.data );
					req.body = req.data;
					req.request = url.pathname;
					req.context = req.method;
					req.query = qs.parse( url.query );

					// fire off the router
					this.exec( req );

				} ).bind( this ) );
			} ).bind( this ) );
		};


		Camino.prototype.event = { error: "error" };

		/**
		 * Basic error handling, had to move this here so event listener can use it
		 */

		Camino.prototype.error = function( data, responder ) {
			responder = responder || options.responder

			// since the only errors currently get triggered before a route can
			// even be determined, there's no point in trying to use a route-
			// specific responder. hopefully this doesn't become a problem
			responder.writeHead( data.status, {
				"Content-Type": "application/json"
			} );

			responder.end( JSON.stringify( data ) );
		};

		module.exports = new Camino;

		// fire up some basic error reporting
		module.exports.on( "error", module.exports.error );
	}

	// now the browser stuff
	else {


		/**
		 * Shim for browsers
		 */

		Camino.prototype.emit = function( event, data ) {
			root.dispatchEvent( new CustomEvent( event, { detail: data } ) );
		};



		Camino.prototype.event = { error: "camino:error" };

		/**
		 * Please replace this
		 */

		Camino.prototype.error = function( event, data ) {
			console.log(event.detail)
		};


		/**
		 * Attach the appropriate listener to the emitting object, and wait for
		 * an event.
		 */

		Camino.prototype.listen = function( emitter, opt, responder ) {
			var listener = emitter.on || emitter.addEventListener;
			options.responder = responder || console.log.bind(console);

			if( typeof opt === "function" || typeof opt === "undefined" ) {
				responder = opt;
				opt = {};
			}

			var event = ( opt.history ? "popstate" : "hashchange" );

			listener.call( emitter, event, ( function() {
				// augment location object
				emitter.location.request = ( opt.history
					? emitter.location.pathname
					: emitter.location.hash );

				this.exec( emitter.location );

			} ).bind( this ) );
		};

		root.camino = new Camino;

		root.addEventListener( "camino:error", root.camino.error );
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
		route = "^" + route + "$";
		// route_str.push(route);

		// add the route and it's crap to the stack
		var ret = {
			callback: cb,
			params: params
		};

		if( typeof opt.responder !== "undefined" )
			ret.responder = opt.responder;


		if( typeof opt.context !== "undefined" ) {
			ret.context = opt.context.map( function(s) {
				return s.toLowerCase()
			});
		}

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
			this.emit( this.event.error, {
				status: 404,
				success: false,
				message: 'Resource not found'
			} );

			return false;
		}

		// this gets referenced a lot, so might as well make it a bit prettier
		var route = routes[sub];

		// check if the context requested is accepted by the callback
		if( typeof route.context !== "undefined"
			&& route.context.indexOf( map.context.toLowerCase() ) === -1 ) {
				this.emit( this.event.error, {
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

})();