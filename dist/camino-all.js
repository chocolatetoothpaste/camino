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
	
	Camino.prototype.listen = function listen( emitter, opt, responder ) {
		// available options and their defaults
		var dict = { sort: true };
	
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
	
		var req = {
			request: emitter.location,
			response: responder
		};
	
		var prev_loc = '';
		var prev_hash = '';
	
		// set event listener for history api if optioned
		emitter.addEventListener( "popstate", (function(event) {
			var current_loc = JSON.stringify({
				path: req.request.pathname,
				query: req.request.search
			});
	
			if( opt.history && ( ! prev_loc && prev_hash !== req.request.hash
				|| req.request.hash === '' ) ) {
					prev_loc = current_loc;
					req.path = req.request.pathname;
					req.url = req.request.pathname + req.request.search;
					this._exec( req );
			}
	
			if( opt.hash ) {
				prev_hash = req.path = req.request.hash;
	
				if( req.request.hash === '' ) {
					prev_hash = '';
					this.emit( this.event.nohash, null, req );
				}
				else {
					this._exec( req );
				}
			}
		}).bind(this), false );
	
		// fire initial "popstate" event to route on page load
		if( opt.init ) {
			window.dispatchEvent( new Event('popstate') );
		}
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
		req.qs.split( "&" ).forEach(function( val ) {
			var v = val.split( '=' );
	
			if( _g.options.decode ) {
				v.map(decodeURIComponent);
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
	
	
	Camino.prototype.location = function location(loc, data, title) {
		history.pushState(data, title, loc);
		window.dispatchEvent( new Event('popstate') );
	};
	
	
	Camino.prototype.replace = function replace(loc, data, title) {
		history.replaceState(data, title, loc);
		window.dispatchEvent( new Event('popstate') );
	};
	
	
	// create a new instance in the global scope
	window.camino = new Camino;

}



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

	// _g.routes.forEach(function(r) {
	// 	console.log(r.sort);
	// });
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