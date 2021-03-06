(function() {
"use strict";
// containers for data that needs a broader scope
var _g = {

	// the main container for defined routes
	routes: [],
	def: [],

	// server doesn't use this but the browser does
	options: {},

	// store location (and hash) from request to request (browser only)
	location: '',
	hash: ''
};

// main object constructor
function Camino() {
	this.version = '1.0.1';
}

/**
 *	Shim for event names (namespacing for browsers)
 */

Camino.prototype.event = {
	error: "camino.error",
	route: "camino.route",
	request: "camino.request",
	match: "camino.match",
	nohash: "camino.nohash",
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
	if( typeof opt === 'function' ) {
		responder = opt;
		opt = dict;
	}

	else if( typeof opt === 'undefined' ) {
		opt = dict;
	}

	// merge user and default options
	else {
		for( var i in dict ) {
			opt[i] = ( typeof opt[i] === 'undefined' ? dict[i] : opt[i] );
		}
	}

	_g.options = opt;

	if( opt.sort ) {
		this.sort();
	}

	// add listener for "match" event and execute callback if matched
	emitter.addEventListener( this.event.match, (event) => {
		this.emit( this.event.exec );
		event.detail.request.route.callback.call( null, event.detail.request );
	});

	// set event listener for history api if optioned
	emitter.addEventListener( 'popstate', () => {
		this.resolve(event, responder, opt);
	}, false );

	// fire initial "popstate" event to route on page load
	if( opt.init ) {
		this.init();
	}
};


Camino.prototype.resolve = function resolve(event, responder, opt) {
	// the main request object to pass around
	var req = {
		request: event.target.location,
		response: responder
	};

	// route request if location has changed, but not if hash only has changed
	if( opt.history && ( ! _g.location && _g.hash !== req.request.hash || req.request.hash === '' ) ) {
		_g.location = JSON.stringify({
			path: req.request.pathname,
			query: req.request.search
		});

		req.path = req.request.pathname;
		req.url = req.request.pathname + req.request.search;
		this._exec( req );
	}

	// hash requests are always executed, not instead of 
	if( opt.hash ) {
		_g.hash = req.request.hash;

		if( req.request.hash === '' ) {
			this.emit( this.event.nohash, req );
		}
		else {
			req.path = _g.hash;
			this._exec( req );
		}
	}
};


Camino.prototype.init = function init() {
	// intercept clicks and check if they match existing routes
	var routex = new RegExp(_g.def.join('|'));

	window.addEventListener('click', ( event ) => {
		if( event.target.tagName === 'A' && event.target.hasAttribute('href') ) {
			// remove query string, it's not part of the routes
			var href = event.target.getAttribute('href');
			
			if( routex.test(href.split('?')[0]) ) {
				window.history.pushState( null, null, href );
				window.dispatchEvent( new CustomEvent('popstate') );	
				event.preventDefault();
			}
		}
	});

	// fire off initial event on page load to route initial request
	window.dispatchEvent( new CustomEvent('popstate') );
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

	// split query string into pairs
	req.qs.split( '&' ).forEach( ( val ) => {
		var v = val.split( '=' );

		if( _g.options.decode ) {
			v = v.map(decodeURIComponent);
		}

		req.query[ v[0] ] = v[1];
	});

	this.match( req );
};


/**
 * Shim emit method for browsers
 */

Camino.prototype.emit = function emit( event, err, req ) {
	// musical vars
	if( typeof req === 'undefined' ) {
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


Camino.prototype.location = function location(loc, data, title) {
	history.pushState(data, title, loc);
	window.dispatchEvent( new CustomEvent('popstate') );
};


Camino.prototype.replace = function replace(loc, data, title) {
	history.replaceState(data, title, loc);
	window.dispatchEvent( new CustomEvent('popstate') );
};


Camino.prototype.request = function request(req) {
	this._exec( { qs: '', query: '', path: req, request: { search: '' } } );
};


// create a new instance in the global scope
window.camino = new Camino;




/**
 * Sort routes to match most complete path first
 */

Camino.prototype.sort = function sort() {
	// sort routes based on their modified length
	// param names are scrubbed so the playing field is level
	// put routes with @/% at the bottom so explicit routes match first
	_g.routes.sort( (a, b) => b.sort.length - a.sort.length || ! /[@|%]/g.test( a.sort ) );
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
		return false;
	}

	// if method is not allowed for route, emit 405 (method not allowed) error
	if( route.methods.length > 0 && route.methods.indexOf( req.method ) === -1 ) {
		var err = new Error('Method not allowed');
		err.status = 405;
		this.emit( this.event.error, err, req );

		// stop the browser
		return false;
	}

	// use the route responder if it's set, otherwise just the native/default
	req.response = route.responder || req.response;
	req.route = route;
	req.params = {};

	// make key/value pair from matched route params
	match.forEach( ( v, k ) => {
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
		.map( ( v ) => v.substr( 1 ) );

	// replace param names with regexes
	var match = r.replace( /@(\w+)/g, "([\\w\\-\\.]+)" )

		// this one was hard to write. it checks for 0 or 1 occ. of "/"
		// or, 0 or 1 param (string, not "/") if 1 occ. of "/"" was found
		.replace( /\/%(\w+)/g, "(?:/?|/([\\w\\-\\.]+))" );

	// wrap the route with regexp string delimiters
	match = `^${match}$`;

	// throw an error if trying to redefine a route
	if( _g.def.indexOf(match) !== -1 )
		throw new Error( `Route is already defined: ${r}` );

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

	// var idx = _g.def.indexOf(match);
	// // throw an error if trying to redefine a route
	// if( idx !== -1 ) {
	// 	let def = _g.routes[idx].route;
	// 	throw new Error( `Route is already defined: ${def}, new route: ${r}` );
	// }

	_g.routes.push(route);
	_g.def.push(match);

	this.emit( this.event.route, route );
};

})();
