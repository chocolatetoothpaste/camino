var util = require( "util" ),
	events = require( "events" ),
	querystring = require( 'querystring' );

// a couple default handlers for common content types

var handler = {
	"application/json": function application_json( req ) {
		this._data( req, JSON.parse );
	},

	"application/x-www-form-urlencoded": function application_x_www_form_urlencoded( req ) {
		this._data( req, querystring.parse );
	}
};


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

Camino.prototype.listen = function listen( emitter, opt, responder ) {
	// available options and their defaults
	var dict = { sort: true, defaultType: '', defaultMethods: [] };

	// musical vars
	if( typeof opt === "function" ) {
		responder = opt;
		opt = dict;
	}

	else if( typeof opt === "undefined" ) {
		opt = dict;
	}

	// merge user and default options
	else {
		for( var i in dict ) {
			opt[i] = ( typeof opt[i] === "undefined" ? dict[i] : opt[i] );
		}
	}

	_g.options = opt;

	this.init();

	emitter.on( 'request', (function( request, res ) {
		// emit "request" event
		this.emit( this.event.request );

		var url = require( 'url' ).parse( request.url );

		var req = {
			request: request,
			response: responder || res,
			url: request.url,
			method: request.method,

			// request.url without the querystring
			path: url.pathname,

			// query string parsed into object
			query: querystring.parse( url.query ),

			// the original query string, without '?'
			qs: url.query
		};

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

Camino.prototype._exec = function _exec( req ) {
	// grab the content type or set an empty string
	var type = ( req.request.headers["content-type"]
		? req.request.headers["content-type"].split(';')[0].toLowerCase()
		: _g.options.defaultType );

	if( typeof handler[type] === "function" ) {
		// maintaining context with call
		handler[type].call( this, req );
	}

	else if( type === "" ) {
		this._data( req );
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
	handler[type] = cb;
};


/**
 * The majority of content types will just grab the incoming data stream and
 * parse it, this is a convenience method for grabbing that data
 */

Camino.prototype._data = function _data( req, cb ) {
	var self = this;

	// create empty string for appending request body data
	req.raw = '';

	// concatenate incoming data chunks (=^･^=) meow :)
	var cat_chunks = function cat_chunks( chunk ) {
		req.raw += chunk;
	}

	// grab the request body data, if provided
	req.request.on( 'data', cat_chunks );

	// parse request data and execute route callback
	req.request.once( 'end', function() {
		req.request.removeListener( 'data', cat_chunks );

		req.data = ( req.raw.length > 0 && typeof cb === "function"
			? cb.call( null, req.raw )
			: {} );

		self.emit( self.event.exec );

		// execute the callback, pass through request and responder handlers
		req.route.callback.call( null, req );
	});
};

// exporting an instance instead of a reference for convenience and to
// discourage multiple instances (which probably wouldn't work)
module.exports = new Camino;
