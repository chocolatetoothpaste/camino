var util = require( "util" ),
	events = require( "events" );

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

		var qs = require( 'querystring' ),
			url = require( 'url' ).parse( req.url );

		// req.url without the querystring
		req.request = url.pathname;

		// query string parsed into JSON object
		req.query = qs.parse( url.query );

		// the original query string, without the '?'
		req.qs = url.query;

		// try to match the request to a route
		this.match( req );

	// bind callback to Camino's scope, eliminte "var self = ..." bastard
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

	// assign the responder, either custom or global
	var responder = req.route.responder || global.options.responder;

	// process multipart form data (uploads...)
	if( type === 'multipart/form-data' ) {
		// pass off to delegate
		this._multipart( req, responder );
	}

	else {
		// create empty string for appending request body data
		req.data = '';

		// grab the request body data, if provided
		req.on( 'data', function( chunk ) {
			req.data += chunk;
		});


		// parse request data and execute route callback
		req.on( 'end', function() {
			req.data = ( type === 'application/json'
				? JSON.parse( req.data )
				: require('querystring').parse( req.data ) );

			self.emit( self.event.exec );

			// execute the callback, pass through request and responder handlers
			req.route.callback.call( null, req, responder );
		});
	}

};


/**
 * Delegate for handling multi-part form data (uploads)
 */

Camino.prototype._multipart = function( req, responder ) {
	var self = this,
		Busboy = require( 'busboy' ),
		busboy = new Busboy({ headers: req.headers });

	req.files = {};
	req.data = {};

	// grab uploaded files and stream them into buffers
	// full args for future reference, removed to save memory...?
	// busboy.on( 'file', function( field, file, name, enc, mime ) {
	busboy.on( 'file', function( field, file ) {
		// container for concatenating incoming data stream into a buffer
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
		req.route.callback.call( null, req, responder );

	});

	// believe in the cleansing power of the pipe! [ad s1e15]
	req.pipe( busboy );
};


/**
 * Basic error handling
 * Don't move this code, it's placement is important
 */

// This should be replaced by the user to conform with their implementation
// but this basic implementation follows common practices and should be
// adequate for getting started

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