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

	g.options = opt;

	// set a default responder for testing/getting started
	var req = {
		request: emitter.location,
		response: responder || console.log.bind( console )
	};

	// add listener for "match" event and execute callback if matched
	emitter.addEventListener( this.event.match, (function(event) {
		this.emit( this.event.exec );

		event.detail.request.route.callback.call( null, event.detail.request );
	}).bind(this));

	// set event listener for history api if optioned
	if( opt.history ) {
		// adding a placeholder for the "current" location so popstates
		// fired on hashchange events can be mitigated
		var current_location = null;

		emitter.addEventListener( "popstate", (function() {
			// if request is the same as current location, don't execute again
			if( req.request.pathname + req.request.search !== current_location ) {
				// set the new "current" location
				req.path = req.request.pathname;
				current_location = req.request.pathname + req.request.search;
				this._exec( req );
			}
		}).bind(this), false );

		// fire initial "popstate" event to route on page load
		if( opt.init ) {
			window.dispatchEvent( new Event('popstate') );
		}
	}

	// set up all hash event code
	if( opt.hash ) {
		emitter.addEventListener( "hashchange", (function() {
			// no need to check for request vs current hash,
			// browser obeserves hash CHANGE
			req.path = req.request.hash;
			this._exec( req );
		}).bind(this) );

		// fire initial "hashchange" event on page load
		if( opt.init && req.request.hash !== '' ) {
			window.dispatchEvent( new Event('hashchange') );
		}
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

	if( g.options.decode )
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