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

	emitter.addEventListener( this.event.nohash, (function(event) {
		console.log("no hash", event)
	}).bind(this), false);

	// add listener for "match" event and execute callback if matched
	emitter.addEventListener( this.event.match, (function(event) {
		this.emit( this.event.exec );

		event.detail.request.route.callback.call( null, event.detail.request );
	}).bind(this));

	var req = {
		request: emitter.location,
		response: responder
	};

	var prev_loc = null;
	var prev_hash = null;

	// set event listener for history api if optioned
	emitter.addEventListener( "popstate", (function(event) {

		// var current_loc = JSON.stringify({
		// 	path: req.request.pathname,
		// 	query: req.request.search
		// });

		// if request is the same as current location, don't execute again
		// if( opt.history && ! prev_loc || current_loc !== prev_loc) {
			// set the new "current" location
			req.path = req.request.pathname;
			req.url = req.request.pathname + req.request.search;
			// prev_loc = current_loc;
			this._exec( req );
		// }
	}).bind(this), false );


	emitter.addEventListener( "hashchange", (function(event) {
		if( opt.hash && ( ! prev_hash || req.request.hash !== prev_hash ) ) {
			req.path = req.request.hash;

			if( req.request.hash === '' ) {
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