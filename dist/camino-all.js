(function() {
"use strict";
// containers for data that needs a broader scope
var _g = {

	// the main container for defined routes
	routes: {},

	// array container for just route regexes (for sorting and looped matching)
	rarr: [],

	// server doesn't use this but the browser does
	options: {}
};

// main object constructor
function Camino() { }

// node.js specific stuff
if( typeof module !== "undefined" && module.exports ) {
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
	
			var url = require( 'url' ).parse( req.url );
	
			var creq = {
				request: req,
				response: responder || res,
				url: req.url,
				method: req.method,
	
				// req.url without the querystring
				path: url.pathname,
	
				// query string parsed into object
				query: querystring.parse( url.query ),
	
				// the original query string, without '?'
				qs: url.query
			};
	
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
	
		if( typeof this._handler[type] === "function" ) {
			// maintaining context with call
			this._handler[type].call( this, req );
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
	
	
	// create an instance to export and attach event listeners
	var camino = new Camino;
	
	// exporting an instance instead of a reference for convenience and to
	// discourage multiple instances (which probably wouldn't work)
	module.exports = camino;

}

// now the browser stuff
else {

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
		var dict = { decode: true, history: true, hash: true, init: true };
	
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

}



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
	for( var route in _g.routes ) {
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
	route = _g.routes[route];

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
	var route = r.replace( /@(\w+)/g, "([\\w\\-\\.]+)" )

		// this one was hard to write. it checks for 0 or 1 occ. of "/"
		// or, 0 or 1 param (string, not "/") if 1 occ. of "/"" was found
		.replace( /\/%(\w+)/g, "(?:/?|/([\\w\\-\\.]+))" );

	// wrap the route with regexp string delimiters
	route = "^" + route + "$";

	// throw an error if trying to redefine a route
	if( typeof _g.routes[route] !== "undefined" )
		throw new Error( "Route is already defined: " + r );

	// define the route data object
	_g.routes[route] = {

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

	this.emit( this.event.route, _g.routes[route] );
};

})();