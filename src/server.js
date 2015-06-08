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

Camino.prototype.listen = function listen( emitter, responder ) {
	emitter.on( 'request', (function( req, res ) {
		// emit "request" event
		this.emit( this.event.request );

		// assign the global response object
		var creq = { request: req, response: responder || res };

		var url = require( 'url' ).parse( req.url );

		// req.url without the querystring
		creq.path = url.pathname;

		// query string parsed into object
		creq.query = querystring.parse( url.query );

		// the original query string, without '?'
		creq.qs = url.query;

		creq.method = req.method;

		// try to match the request to a route
		this.match( creq );

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

Camino.prototype._exec = function _exec( req ) {
	// grab the content type or set an empty string
	var type = ( req.request.headers["content-type"]
		? req.request.headers["content-type"].split(';')[0].toLowerCase()
		: "" );

	// use the route responder if it's set, otherwise just the native/default
	req.response = req.route.responder || req.response;

	if( typeof this._handler[type] === "function" ) {
		// maintaining context with call
		this._handler[type].call( this, req );
	}

	else {
		// Throw an error since an acceptable content-type was not found
		var err = new Error('Invalid content type: ' + type);
		err.status = 415;
		this.emit( this.event.error, err, req );
	}

};


/**
 * Register a handler for a content type
 * (fancy-talk for add a property to an object)
 */

Camino.prototype.handle = function handle( type, cb ) {
	this._handler[type] = cb;
};


/**
 * Container object for content type handlers, and a couple default handlers
 */

Camino.prototype._handler = {
	"application/json": function application_json( req ) {
		this._data( req, JSON.parse );
	},

	"application/x-www-form-urlencoded": function application_x_www_form_urlencoded( req ) {
		this._data( req, querystring.parse );
	}
};


/**
 * The majority of content types will just grab the incoming data stream and
 * parse it, this is a convenience method for grabbing that data
 */

Camino.prototype._data = function _data( req, cb ) {
	var self = this;

	// create empty string for appending request body data
	req.raw = '';

	// grab the request body data, if provided
	req.request.on( 'data', function( chunk ) {
		req.raw += chunk;
	});

	// parse request data and execute route callback
	req.request.on( 'end', function() {
		req.data = ( req.raw.length > 0 && typeof cb === "function"
			? cb.call( null, req.raw )
			: {} );

		self.emit( self.event.exec );

		// execute the callback, pass through request and responder handlers
		req.route.callback.call( null, req );
	});
};


// create an instance to export and attach event listeners
var camino = new Camino;

// exporting an instance instead of a reference for convenience and to
// discourage multiple instances (which probably wouldn't work)
module.exports = camino;