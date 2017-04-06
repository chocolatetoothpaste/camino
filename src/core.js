(function() {
"use strict";
// containers for data that needs a broader scope
var _g = {

	// the main container for defined routes
	routes: [],
	def: [],

	// server doesn't use this but the browser does
	options: {}
};

// main object constructor
function Camino() {
	this.version = //=@@camino-version@@
}

//=@@include-camino@@



/**
 * Do some set up before firing off the main listener
 */

Camino.prototype.sort = function sort() {
	if( _g.options.sort ) {
		_g.routes.sort(function(a, b) {
			// sort routes based on their modified length
			// param names are scrubbed so the playing field is level
			// put routes with @/% at the bottom so explicit routes match first
			return b.sort.length - a.sort.length || ! /[@|%]/g.test( a.sort );
		});
	}
};


/**
 * Compare request to routes list and look for a match
 */

Camino.prototype.match = function match( req ) {
	var match = null, route = null;

	// loop through and try to find a route that matches the request
	// I wish there was a more efficient way to do this
	for( var ii = 0, l = _g.routes.length; ii < l; ii++ ) {
		match = RegExp( _g.routes[ii].match, 'g' ).exec( req.path );

		// if a match was found, break the loop and do some clean up
		if( match !== null ) {
			// make a copy (the long way so callback doesn't get dropped)
			route = {
				route: _g.routes[ii].route,
				callback: _g.routes[ii].callback,
				params: _g.routes[ii].params,
				responder: _g.routes[ii].responder,
				methods: _g.routes[ii].methods
			};

			// wish there were some flags to make the output cleaner...
			delete match.index;
			delete match.input;

			// the first key is the string that was matched, ditch it
			match.shift();

			break;
		}
	}

	// if no route was found, emit 404 (not found) error
	if( ! match ) {
		var err = new Error('Resource not found: ' + req.path);
		err.status = 404;
		this.emit( this.event.error, err, req );

		// stop the browser
		return;
	}

	// if method is not allowed for route, emit 405 (method not allowed) error
	if( route.methods.length > 0 && route.methods.indexOf( req.method ) === -1 ) {
		var err = new Error('Method not allowed');
		err.status = 405;
		this.emit( this.event.error, err, req );

		// stop the browser
		return;
	}

	// use the route responder if it's set, otherwise just the native/default
	req.response = route.responder || req.response;
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

	if( typeof cb !== 'function' ) {
		throw new Error('Invalid callback type: ' + typeof cb);
	}

	// extract param names from the route
	var params = ( r.match( /[@|%]\w+/g ) || [] )

		// trim @/% from param name
		.map( function( v ) { return v.substr( 1 ) } );

	// replace param names with regexes
	var match = r.replace( /@(\w+)/g, "([\\w\\-\\.]+)" )

		// this one was hard to write. it checks for 0 or 1 occ. of "/"
		// or, 0 or 1 param (string, not "/") if 1 occ. of "/"" was found
		.replace( /\/%(\w+)/g, "(?:/?|/([\\w\\-\\.]+))" );

	// wrap the route with regexp string delimiters
	match = "^" + match + "$";

	// throw an error if trying to redefine a route
	if( _g.def.indexOf(r) !== -1 )
		throw new Error( "Route is already defined: " + r );

	// define the route object
	var route = {

		// the original route as defined by the user, before tokens are
		// converted into regular expressions
		route: r,

		// these properties are used for internal purposes and are removed
		// before the route is exposed to the end user
		match: match,
		sort: r.replace(/([@|%])\w+/g, '$1'),

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

	if( typeof _g.options.defaultMethods !== 'undefined' )
		route.methods = route.methods.concat(_g.options.defaultMethods)

	// throw an error if trying to redefine a route
	if( _g.def.indexOf(route.sort) !== -1 )
		throw new Error( "Route is already defined: "
			+ _g.routes[_g.def.indexOf(route.sort)].route
			+ ',  Your route: ' + r );

	_g.routes.push(route);
	_g.def.push(route.sort);

	this.emit( this.event.route, route );
};

})();
