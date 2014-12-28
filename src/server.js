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