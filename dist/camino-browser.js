(function() {
// not sure what purpose this serves, seems to be a common thing with node modules
var root = this,

	// containers for data that needs a broader scope
	global = {

		// the main container for routes that are defined
		routes: {},

		// the main container for global options
		options: {}
	};

// main object constructor
function Camino() { }

/**
 *	Shim for event names (namespacing for browsers)
 */

Camino.prototype.event = {
	error: "camino.error",
	route: "camino.route",
	request: "camino.request",
	match: "camino.match",
	exec: "camino.exec"
};


/**
 * Attach the appropriate listener to the emitting object, and wait for
 * an event.
 */

Camino.prototype.listen = function( emitter, opt, responder ) {
	// available options and their defaults
	var dict = { decode: true, history: false, hash: true };

	// musical vars
	if( typeof opt === "function" ) {
		responder = opt;
		opt = dict;
	}

	// merge user and default options
	else {
		for( var i in dict ) {
			opt[i] = ( typeof opt[i] === "undefined" ? dict[i] : opt[i] );
		}
	}

	global.options = opt;

	// set a default responder for testing/getting started
	global.options.responder = responder || console.log.bind( console );

	var req = emitter.location;

	// set event listener for history api if optioned
	if( opt.history ) {
		// adding a placeholder for the "current" location so popstates
		// fired on hashchange events can be mitigated
		var location = null;

		emitter.addEventListener( "popstate", (function() {
			if( req.pathname !== location ) {
				// augment the request object with "request" param
				location = req.request = req.pathname;
				this._exec( req );
			}
		}).bind(this), false );
	}

	// defaults to true, but allow user the option to ignore hash events
	if( opt.hash ) {
		// set a hash event listener
		emitter.addEventListener( "hashchange", (function(e) {
			// augment the request object with "request" param
			req.request = req.hash;
			this._exec( req );
		}).bind(this) );
	}

	// add listener for "match" event and execute callback if matched
	emitter.addEventListener( this.event.match, (function() {
		// assign the responder, either custom or global
		var responder = req.route.responder || global.options.responder;

		this.emit( this.event.exec );

		req.route.callback.call( null, req, responder );
	}).bind(this));
};


/**
 * Prep the request and pass it off to be matched
 */

Camino.prototype._exec = function( req ) {
	this.emit( this.event.request, req );

	// the query string with "?" trimmed
	req.qs = req.search.substr( 1 );

	// initialize empty object
	req.query = {};

	if( global.options.decode )
		req.qs = decodeURI(req.qs);

	// split query string into pairs, decode the UI
	// decodeURI(req.qs).split( "&" ).forEach(function( val ) {
	req.qs.split( "&" ).forEach(function( val ) {
		var v = val.split( '=' );
		req.query[ v[0] ] = v[1];
	});

	this.match( req );
};


/**
 * Shim emit method for browsers
 */

Camino.prototype.emit = function( event, data ) {
	window.dispatchEvent( new CustomEvent( event, { detail: data }) );
};


/**
 * Please replace this, end user
 */

Camino.prototype.error = function( event ) {
	console.log( event.detail );
};

// create a new instance in the global scope
window.camino = new Camino;

// attach listeners for errors
window.addEventListener( window.camino.event.error, window.camino.error );

/**
 * Compare request to routes list and look for a match
 */

Camino.prototype.match = function( req ) {
	// loop through and try to find a route that matches the request
	// I wish there was a more efficient way to do this
	for( var route in global.routes ) {
		var match = RegExp( route, 'g' ).exec( req.request );

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

	console.log(req.method);

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

		// r.match grabs param names including @/%, so trim the first char
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
 * print to console all defined routes (for testing purposes)
 */

Camino.prototype.list = function() {
	console.log( global.routes );
};

})();