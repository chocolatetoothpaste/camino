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
	var dict = { decode: true, history: false, hash: true, init: true };

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
	g.options.responder = responder || console.log.bind( console );

	var req = emitter.location;

	// add listener for "match" event and execute callback if matched
	emitter.addEventListener( this.event.match, (function() {
		// assign the responder, either custom or global
		var responder = req.route.responder || g.options.responder;

		this.emit( this.event.exec );

		req.route.callback.call( null, req, responder );
	}).bind(this));

	// set event listener for history api if optioned
	if( opt.history ) {
		// adding a placeholder for the "current" location so popstates
		// fired on hashchange events can be mitigated
		var location = null;

		emitter.addEventListener( "popstate", (function() {
			// if request is the same as current location, don't execute again
			if( req.pathname + req.search !== location ) {
				// set the new "current" location
				req.request = req.pathname
				location = req.pathname + req.search;
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
		emitter.addEventListener( "hashchange", (function(e) {
			// no need to check for request vs current hash,
			// browser obeserves hash CHANGE
			req.request = req.hash;
			this._exec( req );
		}).bind(this) );

		// fire initial "hashchange" event on page load
		if( opt.init && req.hash !== '' ) {
			window.dispatchEvent( new Event('hashchange') );
		}
	}
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