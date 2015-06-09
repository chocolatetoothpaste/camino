(function() {
"use strict";
// containers for data that needs a broader scope
var g = {

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

Camino.prototype.listen = function listen( emitter, responder ) {
	emitter.on( 'request', (function( req, res ) {
		// emit "request" event
		this.emit( this.event.request );

		// assign the global response object
		var creq = { request: req, response: responder || res };

		var url = require( 'url' ).parse( req.url );

		creq.url = req.url;

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

	else if( type === "" ) {
		var self = this;

		// create empty string for appending request body data
		req.raw = '';

		// concatenate incoming data chunks (=^･^=) meow :)
		var cat_chunks = function cat_chunks1( chunk ) {
			req.raw += chunk;
		}

		req.request.on( 'data', cat_chunks );

		// parse request data and execute route callback
		req.request.once( 'end', function() {
			req.request.removeListener( 'data', cat_chunks );
			req.data = {};

			self.emit( self.event.exec );

			// execute the callback, pass through request and responder handlers
			req.route.callback.call( null, req );
		});
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

	// concatenate incoming data chunks (=^･^=) meow :)
	var cat_chunks = function cat_chunks2( chunk ) {
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


// create an instance to export and attach event listeners
var camino = new Camino;

// exporting an instance instead of a reference for convenience and to
// discourage multiple instances (which probably wouldn't work)
module.exports = camino;


/**
 * Grab route "keys", sort them by length smallest to largest. This array will
 * be used to loop and match in the future to attempt to match the most
 * complete path first. Might screw things up quite badly, too.
 */

// Camino.prototype.init = function() {
// 	g.rarr = Object.keys(g.routes).sort(function(a, b){
// 		return a.length < b.length;
// 	});
// };


/**
 * Compare request to routes list and look for a match
 */

Camino.prototype.match = function match( req ) {
	var match = null;

	// loop through and try to find a route that matches the request
	// I wish there was a more efficient way to do this
	for( var route in g.routes ) {
		match = RegExp( route, 'g' ).exec( req.path );

		// if a match was found, break the loop
		if( match !== null )
			break;
	}

	// if no route was found, emit 404 (not found) error
	if( ! match ) {
		var err = new Error('Resource not found: ' + req.path);
		err.status = 404;
		this.emit( this.event.error, err, req );

		// stop the browser
		return;
	}

	// shorten reference
	route = g.routes[route];

	// if method is not allowed for route, emit 405 (method not allowed) error
	if( route.methods.length > 0
		&& route.methods.indexOf( req.method ) === -1 ) {
			var err = new Error('Method not allowed');
			err.status = 405;
			this.emit( this.event.error, err, req );

			// stop the browser
			return;
	}

	// clean up the misc data from the regexp match
	// wish there were some flags to make the output cleaner...
	delete match.index;
	delete match.input;

	// the first key is the string that was matched, ditch it
	match.shift();

	req.route = route;
	req.params = {};

	// make key/value pair from matched route params
	match.forEach( function( v, k ) {
		if( typeof match[k] !== 'undefined' ) {
			req.params[route.params[k]] = v;
		}
	});

	this.emit( this.event.match, req );
};


/**
 * Define a route to listen for requests
 * r: route, opt: options, cb: callback
 */

Camino.prototype.route = function route( r, opt, cb ) {
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
	if( typeof g.routes[route] !== "undefined" )
		throw new Error( "Route is already defined: " + r );

	// define the route data object
	g.routes[route] = {

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

	this.emit( this.event.route, g.routes[route] );
};

})();