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