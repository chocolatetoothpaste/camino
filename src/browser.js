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
