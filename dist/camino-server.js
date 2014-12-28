(function() {
// containers for data that needs a broader scope
var global = {

	// the main container for defined routes
	routes: {},

	// array container for just route regexes (for sorting and looped matching)
	rarr: [],

	// the main container for global options
	options: {}
};

// main object constructor
function Camino() { }

var util = require( "util" ),
	events = require( "events" ),
	querystring = require( 'querystring' );

// inherit event emitter prototype to allow camino to emit/listen to events
events.EventEmitter.call( Camino );
util.inherits( Camino, events.EventEmitter );


/**
 *	Shim for event names
 */

Camino.prototype.event = {
	error: "error",
	route: "route",
	request: "request",
	match: "match",
	exec: "exec"
};


/**
 * Attach the appropriate listener to the emitting object, and wait for
 * an event.
 */

Camino.prototype.listen = function( emitter, responder ) {
	emitter.on( 'request', (function( req, res ) {
		// emit "request" event
		this.emit( this.event.request );

		// assign the global response object
		global.options.responder = responder || res;

		var url = require( 'url' ).parse( req.url );

		// req.url without the querystring
		req.request = url.pathname;

		// query string parsed into object
		req.query = querystring.parse( url.query );

		// the original query string, without '?'
		req.qs = url.query;

		// try to match the request to a route
		this.match( req );

	// bind callback to Camino's scope
	}).bind( this ) );

	// listen for "match" event to fire and execute callback
	this.on( this.event.match, function( req ) {
		this._exec.call( this, req );
	});
};


/**
 * Execute the user callback associated with a route
 */

Camino.prototype._exec = function( req ) {
	var self = this;

	// grab the content type or set an empty string
	var type = ( req.headers["content-type"]
		? req.headers["content-type"].split(';')[0].toLowerCase()
		: "" );

	// reference the responder, either custom or global
	var responder = req.route.responder || global.options.responder;

	if( typeof self._handlers[type] === "function" ) {
		self._handlers[type].call( self, req, responder );
	}

	else {
		// parse request data and execute route callback
		req.on( 'end', function() {
			// set an empty object for type consistency
			req.data = {};

			self.emit( self.event.exec );

			// execute the callback, pass through request and responder handlers
			req.route.callback.call( null, req, responder );
		});

		req.resume();
	}

};


/**
 * The majority of content types will just grab the incoming data stream and
 * parse it, this is a convenience method for grabbing that data
 */

Camino.prototype._data = function( req, res, cb ) {
	var self = this;

	// create empty string for appending request body data
	req.raw = '';

	// grab the request body data, if provided
	req.on( 'data', function( chunk ) {
		req.raw += chunk;
	});

	// parse request data and execute route callback
	req.on( 'end', function() {
		req.data = cb.call( null, req.raw );

		self.emit( self.event.exec );

		// execute the callback, pass through request and responder handlers
		req.route.callback.call( null, req, res );
	});
};


/**
 * Register a handler for a content type
 * (fancy-talk for add a property to an object)
 */

Camino.prototype.handle = function( type, cb ) {
	this._handlers[type] = cb;
};


/**
 * Container object for content type handlers, and some default handlers
 */

Camino.prototype._handlers = {
	'multipart/form-data': function( req, res ) {
		var self = this;
		var Busboy = require( 'busboy' );
		var busboy = new Busboy({ headers: req.headers });

		req.files = {};
		req.data = {};

		// grab uploaded files and stream them into buffers
		busboy.on( 'file', function( field, file ) {
			var buf = [];

			file.on( 'data', function(data) {
				// push data chunks into contrainer
				buf.push( data );
			});

			file.on( 'end', function() {
				// when finished capturing data, Buffer it
				req.files[field] = Buffer.concat(buf);

				// blow chunks
				buf = undefined;
			});
		});

		// capture incoming fields as they are parsed
		busboy.on( 'field', function( field, val ) {
			req.data[field] = val;
		});

		busboy.on( 'finish', function() {
			self.emit( self.event.exec );

			// fire off route callback
			req.route.callback.call( null, req, res );

		});

		// believe in the cleansing power of the pipe! [ad s1e15]
		req.pipe( busboy );
	},

	'application/json': function( req, res ) {
		this._data( req, res, JSON.parse );
	},

	'application/x-www-form-urlencoded': function( req, res ) {
		this._data( req, res, querystring.parse );
	}
};


/**
 * Basic error handling
 *
 * This should be replaced by the user to conform with their implementation
 * but this basic implementation follows common practices and should be
 * adequate for getting started
 */


Camino.prototype.error = function( err ) {
	var responder = global.options.responder;

	var data = JSON.stringify({
		success: false,
		status: err.status,
		error: err.message
	});

	responder.writeHead( err.status, {
		"Content-Type": "application/json",
		"Content-Length": data.length
	} );

	responder.end( data );
};

// create an instance to export and attach event listeners
var camino = new Camino;

// fire up some basic error listening/reporting
camino.on( camino.event.error, camino.error );

// exporting an instance instead of a reference for convenience and to
// discourage multiple instances (which may not even work)
module.exports = camino;


/**
 * Grab route "keys", sort them by length smallest to largest. This array will
 * be used to loop and match in the future to attempt to match the most
 * complete path first. Might screw things up quite badly, too.
 */

Camino.prototype.init = function() {
	global.rarr = Object.keys(global.routes).sort(function(a, b){
		return a.length < b.length;
	});
};


/**
 * Compare request to routes list and look for a match
 */

Camino.prototype.match = function( req ) {
	var match = null;

	// loop through and try to find a route that matches the request
	// I wish there was a more efficient way to do this
	for( var route in global.routes ) {
		match = RegExp( route, 'g' ).exec( req.request );

		// if a match was found, break the loop
		if( match !== null )
			break;
	}

	// if no route was found (no match), emit 404 (not found) error
	if( ! match ) {
		var err = new Error('Resource not found: ' + req.request);
		err.status = 404;
		this.emit( this.event.error, err );

		// stop the browser
		return false;
	}

	// shorten reference
	route = global.routes[route];

	// if method is not allowed for route, emit 405 (method not allowed) error
	if( route.methods.length > 0
		&& route.methods.indexOf( req.method ) === -1 ) {
			var err = new Error('Method not allowed');
			err.status = 405;
			this.emit( this.event.error, err );

			// stop the browser
			return false;
	}

	// pass matched route info to req object
	req.route = route;

	// clean up the misc data from the regexp match
	// wish there were some flags to make the output cleaner...
	delete match.index;
	delete match.input;

	// the first key is the string that was matched, ditch it
	match.shift();

	// set empty params object for easier testing in user callback
	req.params = {};

	// merge the param names and values
	match.forEach( function( v, k ) {
		if( typeof match[k] !== 'undefined' ) {
			req.params[route.params[k]] = v;
		}
	});

	this.emit( this.event.match, req );
	return true;
};


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

	// extract param names from the route
	var params = ( r.match( /[@|%]\w+/g ) || [] )

		// trim @/% from param name
		.map( function( v ) { return v.substr( 1 ) } );

	// replace param names with regexes
	var route = r.replace( /@(\w+)/g, "(\\w+)" )

		// this one was hard to write. it checks for 0 or 1 occ. of "/"
		// or, 0 or 1 param (string, not "/") if 1 occ. of "/"" was found
		.replace( /\/%(\w+)/g, "(?:/?|/(\\w+))" );

	// wrap the route with regexp string delimiters
	route = "^" + route + "$";

	// throw an error if trying to redefine a route
	if( typeof global.routes[route] !== "undefined" )
		throw new Error( "Route is already defined: " + r );

	// define the route data object
	global.routes[route] = {

		// the original route as defined by the user, before tokens are
		// converted into regular expressions
		route: r,

		// user defined callback for this route
		callback: cb,

		// an array of param names that are defined within the route
		// these param names are used later to create a key/value pair of params
		// defined on incoming requests
		params: params,

		// opt.responder may be undefined at this point, but doesn't seem to
		// cause any issues. undefined === undefined, nbd
		responder: opt.responder,

		// default to empty array for convenience and type consistency
		methods: opt.methods || []
	};

	this.emit( this.event.route, global.routes[route] );
};


/**
 * Create event listener for each of camino's events (for debugging purposes)
 */

Camino.prototype.logEvents = function() {
	var c = this;
	Object.keys(c.event).forEach(function(k) {
		window.addEventListener(c.event[k], function(data) {
			console.log(c.event[k], ": ", data);
		});
	});
};


/**
 * print to console all defined routes (for testing purposes)
 */

Camino.prototype.list = function() {
	console.log( global.routes );
};

})();