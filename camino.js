(function() {
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

		emitter.on( 'request', function( req, res ) {
			// assign the global response object
			global.options.responder = responder || res;

			var qs = require( 'qs' ),
				url = require( 'url' ).parse( req.url );

			req.request = url.pathname;

			// since all methods accept a query string, the query string
			// gets it's own reference
			req.query = qs.parse( url.query );

			// include the original query string
			req.qs = url.query;


			var type = req.headers["content-type"] || '';

			// process multipart form data (uploads...)
			if( type.indexOf( 'multipart/form-data' ) !== -1 ) {
				// don't combine these two, bad things will happen
				req.file = {};
				req.data = {};

				var Busboy = require( 'busboy' );
				var busboy = new Busboy({ headers: req.headers });

				// grab uploaded files and stream them into buffers
				// full args for future reference, removed to save memory...?
				// busboy.on( 'file', function( field, file, name, enc, mime ) {
				busboy.on( 'file', function( field, file ) {
					// create a container
					var buf = [];

					file.on( 'data', function(data) {
						// push data bits into the contrainer
						buf.push(data);
					});

					file.on( 'end', function() {
						// put data in the buffer and assign it to a var
						req.file[field] = Buffer.concat(buf);
						delete buf;
					});
				});

				// valTruncated, keyTruncated are args 3 & 4, no use here yet
				busboy.on( 'field', function( field, val ) {
					req.data[field] = val;
				});

				busboy.on( 'finish', function() {
					// parse for nested/multidemensional form fields
					// getting rid of this parsing shit soon
					req.data = qs.parse( req.data );
					req.file = qs.parse( req.file );

					// fire off route callback
					self.exec( req );
				});

				// believe in the cleansing power of the pipe! [ad s1e15]
				req.pipe( busboy );
			}

			// url encoded from data
			else {

				// initialize the container
				req.data = '';

				// grab the request body, if applicable
				req.on( 'data', function( chunk ) {
					req.data += chunk;
				});

				req.on( 'end', function() {
					// parse the query string
					req.data = qs.parse( req.data );

					// fire off the callback
					self.exec( req );
				});
			}

		});
	};


	/**
	 *	parse multipart form data
	 *

	Camino.prototype.parse = function( data, boundary ) {
		// console.log(boundary);
		// console.log(data);
		// var boundary = ;
		// application/octet-stream

			// 	var boundary = "--" + this.headers["content-type"]
			// 		.match(/boundary\=(.*)/i)[1];

		data = data.split(boundary);
		data.shift();
		data.pop();
		data.forEach( function( v, k ) {
			var field = v.match(/name\="(\w*)"/)[1];
			if( v.indexOf( 'application/octet-stream' ) === -1 ) {

			}
			// console.log(util.inspect(v));

			// delete field.index;
			// delete field.input;
			console.log(field);
			// v = v.split("\r\n\r\n")
			// if( k !== 1 )
				// console.log(v)
		} );

		// console.log(data);
	};

	//*/


	/**
	 *	Shim for event names
	 */

	Camino.prototype.event = { error: "error" };


	/**
	 * Basic error handling
	 * Don't move this code, it's placement is important
	 */

	Camino.prototype.error = function( err, responder ) {
		responder = responder || global.options.responder
		// var status = data.status;
		// data = JSON.stringify( data );

		// since the only errors currently get triggered before a route can
		// even be determined, there's no point in trying to use a route-
		// specific responder. hopefully this doesn't become a problem
		// responder.writeHead( status, {
		// 	"Content-Type": "application/json",
		// 	"Content-Length": data.length
		// } );
		responder.writeHead( err.status );
		responder.end( err.message );
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
		root.dispatchEvent( new CustomEvent( event, { detail: data }) );
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

		emitter.addEventListener.call( emitter, event, (function() {
			// augment location object (for consistency on client/server)
			emitter.location.request = ( opt.history
				? emitter.location.pathname
				: emitter.location.hash );

			this.exec( emitter.location );
		}).bind( this ));
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

	var params = r.match( /[@|%](\w+)/g );

	// until I can figure out how to make string.match capture the right
	// group, this will have to do
	if( params )
		params = params.map( function( v ) { return v.substr( 1 ) } );

	// replace var names with regexes
	var route = r.replace( /@(\w+)/g, "(\\w+)" )
		// this one was hard to write. it checks for 0 or 1 occ. of "/",
		// or, 0 or 1 param (string, not "/") if 1 occ. of "/"" was found
		.replace( /\/%(\w+)/g, "(?:/?|/(\\w+))" );

	// wrap the route with regexp string delimiters
	route = "^" + route + "$";

	if( typeof global.routes[route] !== "undefined" )
		throw new Error( "Route is already defined: " + r );

	// define the route. opt.responder and opt.method may be undefined at
	// this point, but doesn't seem to cause any issues with camino.exec()
	// undefined === undefined, nbd
	global.routes[route] = {
		route: r,
		callback: cb,
		params: params,
		responder: opt.responder,
		methods: opt.method
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

Camino.prototype.exec = function( req ) {
	// loop through and try to find a route that matches the request
	// I wish there was a more efficient way to do this
	for( var route in global.routes ) {
		var match = RegExp( route, 'g' ).exec( req.request );
		if( match !== null )
			break;
	}

	// if no route was found (no match), emit 404 status error
	if( ! match ) {
		var err = new Error('Resource not found');
		err.status = 404;
		this.emit( this.event.error, err );

		// this just stops the browser
		return false;
	}

	// this gets referenced a lot, so re-assign and make it a bit prettier
	route = global.routes[route];

	// if request method is not allowed for this route, emit 405 error
	if( Array.isArray( route.method )
		&& route.method.indexOf( req.method ) === -1 ) {
			var err = new Error('Method not allowed');
			err.status = 405;
			this.emit( this.event.error, err );

			// this just stops the browser
			return false;
	}

	req.route = route;

	// clean up the misc data from the regexp match
	// wish there were some flags to make the output cleaner...
	delete match.index;
	delete match.input;

	// the first key is the string that was matched, ditch it
	match.shift();

	req.params = {};

	// merge the param names and values
	match.forEach( function( v, k ) {
		if( typeof match[k] !== 'undefined' ) {
			req.params[route.params[k]] = v;
		}
	});

	// assign the responder, either custom or global
	var responder = route.responder || global.options.responder;

	// execute the user callback, passing request data and responder
	route.callback.call( null, req, responder );
};
})();