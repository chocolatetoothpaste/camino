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

					// fire off the router ( this = camino )
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
		module.exports.on( module.exports.event.error, module.exports.error );
	}

	// now the browser stuff
	else {


		/**
		 * Shim for browsers
		 */

		Camino.prototype.emit = function( event, data ) {
			root.dispatchEvent( new CustomEvent( event, { detail: data } ) );
		};


		// put all the event strings in here so they can be changed
		Camino.prototype.event = { error: "camino:error" };

		/**
		 * Please replace this
		 */

		Camino.prototype.error = function( event, data ) {
			console.log( event.detail );
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

		root.addEventListener( root.camino.event.error, root.camino.error );
	}


	/**
	 * Define a route to listen for requests
	 */

	Camino.prototype.route = function( route, opt, cb ) {
		var params = route.match(/[@|%](\w+)/g);

		// shift params
		if( typeof opt === "function" ) {
			cb = opt;
			opt = {};
		}

		// until I can figure out how to make string.match capture the right
		// group, this will have to do
		if( params )
			params = params.map( function( v ) { return v.substr(1) } );

		// replace var names with regexes
		route = route.replace( /@(\w+)/g, "(\\w+)" )
			// this one was hard to write. it checks for 0 or 1 "/",
			// then 0 or 1 param if 1 "/"" was found
			.replace( /\/%(\w+)/g, "(?:/?|/(\\w+))" );

		// wrap the route with regexp string delimiters
		route = "^" + route + "$";

		// define the route. opt.responder and opt.context may be undefined at
		// this point, but doesn't seem to cause any issues with camino.exec()
		// undefined === undefined, no biggie
		routes[route] = {
			callback: cb,
			params: params,
			responder: opt.responder,
			context: opt.context
		};
	};


	/**
	 * list all registered routes
	 * this function may have no practical use, but for testing/dev
	 */

	Camino.prototype.list = function() {
		console.log(routes);
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

		// if no route was found (no match), emit 404 status error
		if( ! match ) {
			this.emit( this.event.error, {
				status: 404,
				success: false,
				message: 'Resource not found'
			} );

			// this just stops the browser
			return false;
		}

		// this gets referenced a lot, so might as well make it a bit prettier
		var route = routes[sub];

		// if request method is not allowed for this route, emit 405 status
		// error
		if( typeof route.context !== "undefined"
			&& route.context.indexOf( map.context ) === -1 ) {
				this.emit( this.event.error, {
					status: 405,
					success: false,
					message: 'Method not allowed'
				} );

				// this just stops the browser
				return false;
		}

		// clean up the misc data from the regexp match
		// wish there were some flags to make the output cleaner...
		delete match.index;
		delete match.input;

		// the first key is just the string that was matched, so ditch it
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