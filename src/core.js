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

//=include


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

Camino.prototype.match = function( req ) {
	var match = null;

	// loop through and try to find a route that matches the request
	// I wish there was a more efficient way to do this
	for( var route in g.routes ) {
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
	route = g.routes[route];

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
	console.log( g.routes );
};

})();