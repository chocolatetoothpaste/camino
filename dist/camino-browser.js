(function() {
"use strict";
// containers for data that needs a broader scope
var _g = {

	// the main container for defined routes
	routes: [],

	// server doesn't use this but the browser does
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

Camino.prototype.listen = function listen( emitter, opt, responder ) {
	// available options and their defaults
	var dict = { decode: true, history: true, hash: true, init: true, sort: true };

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

	// add listener for "match" event and execute callback if matched
	emitter.addEventListener( this.event.match, (function(event) {
		this.emit( this.event.exec );

		event.detail.request.route.callback.call( null, event.detail.request );
	}).bind(this));

	// set event listener for history api if optioned
	if( opt.history ) {
		// adding a placeholder for the "current" location so popstates
		// fired on hashchange events can be mitigated
		var current_location = {};

		var phash = '';

		emitter.addEventListener( "popstate", (function(event) {
			// set a default responder for testing/getting started
			var req = {
				request: emitter.location,
				response: responder
			};

			var request = {
				path: req.request.pathname,
				query: req.request.search
			};

			// if request is the same as current location, don't execute again
			if( JSON.stringify(request) !== JSON.stringify(current_location) ) {
				// set the new "current" location
				req.path = req.request.pathname;
				req.url = req.request.pathname + req.request.search;
				current_location = {
					path: req.request.pathname,
					query: req.request.search
				};
				this._exec( req );
			}

			if( opt.hash && req.request.hash !== phash ) {
				event.preventDefault();
				// history.replaceState(null, null, '/profile');
				req.path = req.request.pathname;
				phash = req.request.hash;

				if( phash !== '' ) {
					this._exec( req );
				}
			}
		}).bind(this), false );

		// fire initial "popstate" event to route on page load
		if( opt.init ) {
			window.dispatchEvent( new Event('popstate') );
		}
	}

	/*// set up all hash event code
	if( opt.hash ) {
		emitter.addEventListener( "hashchange", (function() {
			console.log('hashchange');

			if( emitter.location.hash !== '' ) {
				// set a default responder for testing/getting started
				var req = {
					request: emitter.location,
					response: responder
				};

				// no need to check for request vs current hash,
				// browser obeserves hash CHANGE
				req.path = req.request.hash;
				this._exec( req );
			}
		}).bind(this) );

		// fire initial "hashchange" event on page load
		if( opt.init ) {
			window.dispatchEvent( new Event('hashchange') );
		}
	}//*/
};


/**
 * Prep the request and pass it off to be matched
 */

Camino.prototype._exec = function _exec( req ) {
	this.emit( this.event.request, req );

	// the query string with "?" trimmed
	req.qs = req.request.search.substr( 1 );

	// initialize empty object
	req.query = {};

	if( _g.options.decode )
		req.qs = decodeURI(req.qs);

	// split query string into pairs
	req.qs.split( "&" ).forEach(function( val ) {
		var v = val.split( '=' );
		req.query[ v[0] ] = v[1];
	});

	this.match( req );
};


/**
 * Shim emit method for browsers
 */

Camino.prototype.emit = function emit( event, err, req ) {
	// musical vars
	if( typeof req === "undefined" ) {
		req = err;
		err = null;
	}

	var detail = {
		detail: {
			error: err,
			request: req
		}
	};

	window.dispatchEvent( new CustomEvent( event, detail ) );
};


// create a new instance in the global scope
window.camino = new Camino;


/**
 * Do some set up before firing off the main listener
 */

Camino.prototype.init = function init() {
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
	if( route.methods.length > 0
		&& route.methods.indexOf( req.method ) === -1 ) {
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
	// if( typeof _g.routes[route] !== "undefined" )
	// 	throw new Error( "Route is already defined: " + r );

	// define the route data object
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

	_g.routes.push(route);

	this.emit( this.event.route, route );
};

})();