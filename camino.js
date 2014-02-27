( function() {
	var root = this,

		// containers
		global = {
			routes: {},
			options: {}
		};

	// prototype
	function Camino() { };

	// server stuff
	if( typeof module !== "undefined" && module.exports ) {
		var util = require( "util" ),
			events = require( "events" );

		// execute event constructor on camino object and inherit methods
		events.EventEmitter.call( Camino );
		util.inherits( Camino, events.EventEmitter );


		/**
		 * Attach the appropriate listener to the emitting object, and wait for
		 * an event.
		 */

		Camino.prototype.listen = function( emitter, responder ) {
			var self = this;
			emitter.addListener( 'request', ( function( req, res ) {
				global.options.responder = responder || res;
				var qs = require( "qs" ),
					url = require( "url" ).parse( req.url );

				// else... implement multipart parsing to handle file uploads
				// self.parse( req );

				req.request = url.pathname;
				req.context = req.method;
				req.query = qs.parse( url.query );
				req.qs = url.query;

				// augment the request object
				if( typeof req.headers["content-type"] === "undefined"
					|| req.headers["content-type"].split(';')[0] === "application/x-www-form-urlencoded" ) {

						req.data = "";

						// grab the request body, if applicable
						req.on( "data", function( chunk ) {
							req.data += chunk;
						});

						req.on('end', function() {
							req.data = qs.parse( req.data );

							// fire off the router ( this = camino, after binding )
							self.exec( req );
						});

				}

				else {
					req.file = {}
					req.data = {};

					var Busboy = require('busboy');
					var busboy = new Busboy({ headers: req.headers });

					busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
						var fs = require('fs');

						file.pipe(fs.createWriteStream('bus.jpg'));
						req.file[fieldname] = 'bus.jpg';
					});

					busboy.on('field', function(fieldname, val, valTruncated, keyTruncated) {
						req.data[fieldname] = val;
					});

					busboy.on('finish', function() {
						self.exec(req);
					})

					req.pipe(busboy);
				}

			} ) );
		};


		/**
		 *	parse multipart form data
		 */

		// Camino.prototype.parse = function( req ) { };


		/**
		 *	Shim for event names (too generic for browsers)
		 */

		Camino.prototype.event = { error: "error" };


		/**
		 * Basic error handling
		 * Don't move this code, it's placement is important
		 */

		Camino.prototype.error = function( data, responder ) {
			responder = responder || global.options.responder
			var status = data.status;
			data = JSON.stringify( data );

			// since the only errors currently get triggered before a route can
			// even be determined, there's no point in trying to use a route-
			// specific responder. hopefully this doesn't become a problem
			responder.writeHead( status, {
				"Content-Type": "application/json",
				"Content-Length": data.length
			} );

			responder.end( data );
		};

		module.exports = new Camino;

		// fire up some basic error listening/reporting
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


		/**
		 *	Shim for event names (namespacing for browsers)
		 */

		Camino.prototype.event = { error: "camino:error" };


		/**
		 * Please replace this, end user
		 */

		Camino.prototype.error = function( event ) {
			console.log( event.detail );
		};


		/**
		 * Attach the appropriate listener to the emitting object, and wait for
		 * an event.
		 */

		Camino.prototype.listen = function( emitter, opt, responder ) {
			// musical vars
			if( typeof opt === "function" ) {
				responder = opt;
				opt = {};
			}

			// set the event name, and responder
			var event = ( opt.history ? "popstate" : "hashchange" );
			global.options.responder = responder || console.log.bind( console );

			emitter.addEventListener.call( emitter, event, ( function() {
				// augment location object (for consistency on client/server)
				emitter.location.request = ( opt.history
					? emitter.location.pathname
					: emitter.location.hash );

				this.exec( emitter.location );
			} ).bind( this ) );
		};

		root.camino = new Camino;

		root.addEventListener( root.camino.event.error, root.camino.error );

	} // end browser code


	/**
	 * Define a route to listen for requests
	 * r: route, opt: options, cb: callback
	 */

	Camino.prototype.route = function( r, opt, cb ) {
		// shift params
		if( typeof opt === "function" ) {
			cb = opt;
			opt = {};
		}

		else {
			// prevent errors when adding route to the stack at the bottom
			opt.responder = opt.responder || undefined;
			opt.context = opt.context || undefined;
		}

		var params = r.match( /[@|%](\w+)/g );

		// until I can figure out how to make string.match capture the right
		// group, this will have to do
		if( params )
			params = params.map( function( v ) { return v.substr( 1 ) } );

		// replace var names with regexes
		r = r.replace( /@(\w+)/g, "(\\w+)" )
			// this one was hard to write. it checks for 0 or 1 occ. of "/",
			// or, 0 or 1 param (string, not "/") if 1 occ. of "/"" was found
			.replace( /\/%(\w+)/g, "(?:/?|/(\\w+))" );

		// wrap the route with regexp string delimiters
		route = "^" + r + "$";

		if( typeof global.routes[route] !== "undefined" )
			throw new Error( "Route is already defined: " + r );

		// define the route. opt.responder and opt.context may be undefined at
		// this point, but doesn't cause any issues with camino.exec()
		// undefined === undefined, nbd
		global.routes[route] = {
			callback: cb,
			params: params,
			responder: opt.responder,
			context: opt.context
		};
	};


	/**
	 * list all registered routes
	 * this function has no practical use, for testing/dev
	 */

	Camino.prototype.list = function() {
		console.log( global.routes );
	};


	/**
	 * Eexecute the user callback associated with a route
	 */

	Camino.prototype.exec = function( map ) {
		// placeholders
		var match, route;

		// loop through and try to find a route that matches the request
		// I wish there was a more efficient way to do this
		for( route in global.routes ) {
			match = RegExp( route, 'g' ).exec( map.request );
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

		// this gets referenced a lot, so re-assign and make it a bit prettier
		route = global.routes[route];

		// if request method is not allowed for this route, emit 405 error
		if( Array.isArray( route.context )
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

		// the first key is the string that was matched, so ditch it
		match.shift();

		map.params = {};

		// merge the param names and values
		for( var ii = 0, l = match.length; ii < l; ++ii ) {
			// optional params are captured with an undefined value
			// so check that param has a value (or improve the regex)
			if( typeof match[ii] !== 'undefined' ) {
				map.params[route.params[ii]] = match[ii];
			}
		}

		// assign the responder, either custom or global
		var responder = route.responder || global.options.responder;

		// execute the user callback, passing request data and responder
		route.callback.call( null, map, responder );
	};

} )();