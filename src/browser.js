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
	var dict = { decode: true, history: false, hash: true };

	// musical vars
	if( typeof opt === "function" ) {
		responder = opt;
		opt = dict;
	}

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
 * Shim for browsers
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