(function() {
// not sure what purpose this serves, seems to be a common thing with node modules
var root = this,

	// containers for data that needs a broader scope
	global = {

		// the main container for routes that are defined
		routes: {},

		// the main container for global options
		options: {}
	};

// main object constructor
function Camino() { }

// node.js specific stuff
if( typeof module !== "undefined" && module.exports ) {
	var util = require( "util" ),
		events = require( "events" );

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

	Camino.prototype.listen = function( emitter, responder ) {
		emitter.on( 'request', (function( req, res ) {
			// emit "request" event
			this.emit( this.event.request );

			// assign the global response object
			global.options.responder = responder || res;

			var qs = require( 'querystring' ),
				url = require( 'url' ).parse( req.url );

			// req.url without the querystring
			req.request = url.pathname;

			// query string parsed into JSON object
			req.query = qs.parse( url.query );

			// the original query string, without the '?'
			req.qs = url.query;

			// try to match the request to a route
			this.match( req );

		// bind callback to Camino's scope, eliminte "var self = ..." bastard
		}).bind( this ) );

		// listen for "match" event to fire and execute callback
		this.on( this.event.match, function( req ) {
			this._exec.call( this, req );
		});
	};


	/**
	 * Execute the user callback associated with a route
	 */

	Camino.prototype._exec = function( req ) {
		// grab the content type or set an empty string
		var type = ( req.headers["content-type"] || "" )
			// then grab grab the string before the first ";" (and lower case it)
			.split(';')[0].toLowerCase();

		// assign the responder, either custom or global
		var responder = req.route.responder || global.options.responder;

		// process multipart form data (uploads...)
		if( type === 'multipart/form-data' ) {
			// pass off to delegate
			this.formData( req, responder );
		}

		else {
			// create empty string for appending request body data
			req.data = '';

			// grab the request body data, if provided
			req.on( 'data', function( chunk ) {
				req.data += chunk;
			});

			var self = this;

			// parse request data and execute route callback
			req.on( 'end', function() {
				req.data = ( type === 'application/json'
					? JSON.parse( req.data )
					: require('querystring').parse( req.data ) );

				self.emit( self.event.exec );

				// execute the callback, pass through request and responder handlers
				req.route.callback.call( null, req, responder );
			});
		}

	};


	/**
	 * Delegate for handling multi-part form data (uploads)
	 */

	Camino.prototype.formData = function( req, responder ) {
		req.files = {};
		req.data = {};

		var Busboy = require( 'busboy' );
		var busboy = new Busboy({ headers: req.headers });

		// grab uploaded files and stream them into buffers
		// full args for future reference, removed to save memory...?
		// busboy.on( 'file', function( field, file, name, enc, mime ) {
		busboy.on( 'file', function( field, file ) {
			// create a container
			var buf = [];

			file.on( 'data', function(data) {
				// push data bits into the contrainer
				buf.push( data );
			});

			file.on( 'end', function() {
				// put data in the buffer and assign it to a var
				req.files[field] = Buffer.concat(buf);
				buf = undefined;
			});
		});

		busboy.on( 'field', function( field, val ) {
			req.data[field] = val;
		});

		var self = this;

		busboy.on( 'finish', function() {
			self.emit( self.event.exec );

			// fire off route callback
			req.route.callback.call( null, req, responder );

		});

		// believe in the cleansing power of the pipe! [ad s1e15]
		req.pipe( busboy );
	};


	/**
	 * Basic error handling
	 * Don't move this code, it's placement is important
	 */

	// This should be replaced by the user to conform with their implementation
	// but this basic implementation follows common practices and should be
	// adequate for getting started

	Camino.prototype.error = function( err ) {
		var responder = global.options.responder;

		var data = JSON.stringify({
			success: false,
			status: err.status,
			error: err.message
		});

		responder.writeHead( err.status, {
			"Content-Type": "application/json",
			"Content-Length": data.length
		} );

		responder.end( data );
	};

	// create an instance to export and attach event listeners
	var camino = new Camino;

	// fire up some basic error listening/reporting
	camino.on( camino.event.error, camino.error );

	// exporting an instance instead of a reference for convenience and to
	// discourage multiple instances (which may not even work)
	module.exports = camino;
}

// now the browser stuff
else {
		/**
	 *	Shim for event names (namespacing for browsers)
	 */

	Camino.prototype.event = {
		error: "camino:error",
		route: "camino:route",
		request: "camino:request",
		match: "camino:match",
		exec: "camino:exec"
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
				opt[i] = opt[i] || dict[i];
			}
		}

		global.options = opt;

		// set a default responder for testing/getting started
		global.options.responder = responder || console.log.bind( console );

		var req = emitter.location;

		// set event listener for history api of optioned
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

		// set a hash event
		if( opt.hash ) {
			emitter.addEventListener( "hashchange", (function() {
				// augment the request object with "request" param
				req.request = req.hash;
				this._exec( req );
			}).bind(this), false );
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
		// thank you @https://github.com/jonathantneal/EventListener
		// polyfill for ie
		! window.CustomEvent && (function() {
			window.CustomEvent = function CustomEvent( type, dict ) {
				dict = dict || {
					bubbles: false,
					cancelable: false,
					detail: undefined
				};

				try {
					var ev = document.createEvent('CustomEvent');
					ev.initCustomEvent( type, dict.bubbles, dict.cancelable,
						dict.detail );
				} catch( error ) {
					// for browsers which don't support CustomEvent at all,
					// we use a regular event instead
					var ev = document.createEvent('Event');
					ev.initEvent( type, dict.bubbles, dict.cancelable );
					ev.detail = dict.detail;
				}

				return ev;
			};
		})();

		root.dispatchEvent( new CustomEvent( event, { detail: data }) );
	};


	/**
	 * Please replace this, end user
	 */

	Camino.prototype.error = function( event ) {
		console.log( event.detail );
	};

	// create a new instance in the global scope
	root.camino = new Camino;

	// attach listeners for errors
	root.addEventListener( root.camino.event.error, root.camino.error );
} // end browser code


/**
 * Compare request to routes list and look for a match
 */

Camino.prototype.match = function( req ) {
	// loop through and try to find a route that matches the request
	// I wish there was a more efficient way to do this
	for( var route in global.routes ) {
		var match = RegExp( route, 'g' ).exec( req.request );
		// if a match was found, break the loop
		if( match !== null )
			break;
	}

	// if no route was found (no match), emit 404 (not found) error
	if( ! match ) {
		var err = new Error('Resource not found: ' + req.request);
		err.status = 404;
		this.emit( this.event.error, err );

		// stop the browser
		return false;
	}

	// shorten reference
	route = global.routes[route];

	// if method is not allowed for route, emit 405 (method not allowed) error
	if( ( route.methods.length > 0
		&& route.methods.indexOf( req.method ) === -1 )

		// all "OPTIONS" requests should be allowed
		&& req.method !== 'OPTIONS' ) {

			var err = new Error('Method not allowed');
			err.status = 405;
			this.emit( this.event.error, err );

			// stop the browser
			return false;
	}

	// pass matched route info to req object
	req.route = route;

	// clean up the misc data from the regexp match
	// wish there were some flags to make the output cleaner...
	delete match.index;
	delete match.input;

	// the first key is the string that was matched, ditch it
	match.shift();

	// set empty params object for easier testing in user callback
	req.params = {};

	// merge the param names and values
	match.forEach( function( v, k ) {
		if( typeof match[k] !== 'undefined' ) {
			req.params[route.params[k]] = v;
		}
	});

	this.emit( this.event.match, req );
	return true;
};


/**
 * Define a route to listen for requests
 * r: route, opt: options, cb: callback
 */

Camino.prototype.route = function( r, opt, cb ) {
	// shift params
	if( typeof opt === "function" ) {
		cb = opt;
		opt = {};
	}

	// extract param names from the route
	var params = ( r.match( /[@|%]\w+/g ) || [] )

		// r.match grabs param names including @/%, so trim the first char
		.map( function( v ) { return v.substr( 1 ) } );

	// replace param names with regexes
	var route = r.replace( /@(\w+)/g, "(\\w+)" )

		// this one was hard to write. it checks for 0 or 1 occ. of "/"
		// or, 0 or 1 param (string, not "/") if 1 occ. of "/"" was found
		.replace( /\/%(\w+)/g, "(?:/?|/(\\w+))" );

	// wrap the route with regexp string delimiters
	route = "^" + route + "$";

	// throw an error if trying to redefine a route
	if( typeof global.routes[route] !== "undefined" )
		throw new Error( "Route is already defined: " + r );

	// define the route data object
	global.routes[route] = {

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

	this.emit( this.event.route, global.routes[route] );
};


/**
 * print to console all defined routes (for testing purposes)
 */

Camino.prototype.list = function() {
	console.log( global.routes );
};

})();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvcmUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImNhbWluby5qcyIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpIHtcbi8vIG5vdCBzdXJlIHdoYXQgcHVycG9zZSB0aGlzIHNlcnZlcywgc2VlbXMgdG8gYmUgYSBjb21tb24gdGhpbmcgd2l0aCBub2RlIG1vZHVsZXNcbnZhciByb290ID0gdGhpcyxcblxuXHQvLyBjb250YWluZXJzIGZvciBkYXRhIHRoYXQgbmVlZHMgYSBicm9hZGVyIHNjb3BlXG5cdGdsb2JhbCA9IHtcblxuXHRcdC8vIHRoZSBtYWluIGNvbnRhaW5lciBmb3Igcm91dGVzIHRoYXQgYXJlIGRlZmluZWRcblx0XHRyb3V0ZXM6IHt9LFxuXG5cdFx0Ly8gdGhlIG1haW4gY29udGFpbmVyIGZvciBnbG9iYWwgb3B0aW9uc1xuXHRcdG9wdGlvbnM6IHt9XG5cdH07XG5cbi8vIG1haW4gb2JqZWN0IGNvbnN0cnVjdG9yXG5mdW5jdGlvbiBDYW1pbm8oKSB7IH1cblxuXG4vLyBub2RlLmpzIHNwZWNpZmljIHN0dWZmXG5pZiggdHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cyApIHtcblx0cmVxdWlyZSgnLi9zZXJ2ZXIuanMnKSgpO1xufVxuXG4vLyBub3cgdGhlIGJyb3dzZXIgc3R1ZmZcbmVsc2Uge1xuXHQvKkAgc291cmNlTWFwcGluZ1VSTD0uL2Jyb3dzZXIuanMgKi9cbn0gLy8gZW5kIGJyb3dzZXIgY29kZVxuXG5cbi8qKlxuICogQ29tcGFyZSByZXF1ZXN0IHRvIHJvdXRlcyBsaXN0IGFuZCBsb29rIGZvciBhIG1hdGNoXG4gKi9cblxuQ2FtaW5vLnByb3RvdHlwZS5tYXRjaCA9IGZ1bmN0aW9uKCByZXEgKSB7XG5cdC8vIGxvb3AgdGhyb3VnaCBhbmQgdHJ5IHRvIGZpbmQgYSByb3V0ZSB0aGF0IG1hdGNoZXMgdGhlIHJlcXVlc3Rcblx0Ly8gSSB3aXNoIHRoZXJlIHdhcyBhIG1vcmUgZWZmaWNpZW50IHdheSB0byBkbyB0aGlzXG5cdGZvciggdmFyIHJvdXRlIGluIGdsb2JhbC5yb3V0ZXMgKSB7XG5cdFx0dmFyIG1hdGNoID0gUmVnRXhwKCByb3V0ZSwgJ2cnICkuZXhlYyggcmVxLnJlcXVlc3QgKTtcblx0XHQvLyBpZiBhIG1hdGNoIHdhcyBmb3VuZCwgYnJlYWsgdGhlIGxvb3Bcblx0XHRpZiggbWF0Y2ggIT09IG51bGwgKVxuXHRcdFx0YnJlYWs7XG5cdH1cblxuXHQvLyBpZiBubyByb3V0ZSB3YXMgZm91bmQgKG5vIG1hdGNoKSwgZW1pdCA0MDQgKG5vdCBmb3VuZCkgZXJyb3Jcblx0aWYoICEgbWF0Y2ggKSB7XG5cdFx0dmFyIGVyciA9IG5ldyBFcnJvcignUmVzb3VyY2Ugbm90IGZvdW5kOiAnICsgcmVxLnJlcXVlc3QpO1xuXHRcdGVyci5zdGF0dXMgPSA0MDQ7XG5cdFx0dGhpcy5lbWl0KCB0aGlzLmV2ZW50LmVycm9yLCBlcnIgKTtcblxuXHRcdC8vIHN0b3AgdGhlIGJyb3dzZXJcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHQvLyBzaG9ydGVuIHJlZmVyZW5jZVxuXHRyb3V0ZSA9IGdsb2JhbC5yb3V0ZXNbcm91dGVdO1xuXG5cdC8vIGlmIG1ldGhvZCBpcyBub3QgYWxsb3dlZCBmb3Igcm91dGUsIGVtaXQgNDA1IChtZXRob2Qgbm90IGFsbG93ZWQpIGVycm9yXG5cdGlmKCAoIHJvdXRlLm1ldGhvZHMubGVuZ3RoID4gMFxuXHRcdCYmIHJvdXRlLm1ldGhvZHMuaW5kZXhPZiggcmVxLm1ldGhvZCApID09PSAtMSApXG5cblx0XHQvLyBhbGwgXCJPUFRJT05TXCIgcmVxdWVzdHMgc2hvdWxkIGJlIGFsbG93ZWRcblx0XHQmJiByZXEubWV0aG9kICE9PSAnT1BUSU9OUycgKSB7XG5cblx0XHRcdHZhciBlcnIgPSBuZXcgRXJyb3IoJ01ldGhvZCBub3QgYWxsb3dlZCcpO1xuXHRcdFx0ZXJyLnN0YXR1cyA9IDQwNTtcblx0XHRcdHRoaXMuZW1pdCggdGhpcy5ldmVudC5lcnJvciwgZXJyICk7XG5cblx0XHRcdC8vIHN0b3AgdGhlIGJyb3dzZXJcblx0XHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdC8vIHBhc3MgbWF0Y2hlZCByb3V0ZSBpbmZvIHRvIHJlcSBvYmplY3Rcblx0cmVxLnJvdXRlID0gcm91dGU7XG5cblx0Ly8gY2xlYW4gdXAgdGhlIG1pc2MgZGF0YSBmcm9tIHRoZSByZWdleHAgbWF0Y2hcblx0Ly8gd2lzaCB0aGVyZSB3ZXJlIHNvbWUgZmxhZ3MgdG8gbWFrZSB0aGUgb3V0cHV0IGNsZWFuZXIuLi5cblx0ZGVsZXRlIG1hdGNoLmluZGV4O1xuXHRkZWxldGUgbWF0Y2guaW5wdXQ7XG5cblx0Ly8gdGhlIGZpcnN0IGtleSBpcyB0aGUgc3RyaW5nIHRoYXQgd2FzIG1hdGNoZWQsIGRpdGNoIGl0XG5cdG1hdGNoLnNoaWZ0KCk7XG5cblx0Ly8gc2V0IGVtcHR5IHBhcmFtcyBvYmplY3QgZm9yIGVhc2llciB0ZXN0aW5nIGluIHVzZXIgY2FsbGJhY2tcblx0cmVxLnBhcmFtcyA9IHt9O1xuXG5cdC8vIG1lcmdlIHRoZSBwYXJhbSBuYW1lcyBhbmQgdmFsdWVzXG5cdG1hdGNoLmZvckVhY2goIGZ1bmN0aW9uKCB2LCBrICkge1xuXHRcdGlmKCB0eXBlb2YgbWF0Y2hba10gIT09ICd1bmRlZmluZWQnICkge1xuXHRcdFx0cmVxLnBhcmFtc1tyb3V0ZS5wYXJhbXNba11dID0gdjtcblx0XHR9XG5cdH0pO1xuXG5cdHRoaXMuZW1pdCggdGhpcy5ldmVudC5tYXRjaCwgcmVxICk7XG5cdHJldHVybiB0cnVlO1xufTtcblxuXG4vKipcbiAqIERlZmluZSBhIHJvdXRlIHRvIGxpc3RlbiBmb3IgcmVxdWVzdHNcbiAqIHI6IHJvdXRlLCBvcHQ6IG9wdGlvbnMsIGNiOiBjYWxsYmFja1xuICovXG5cbkNhbWluby5wcm90b3R5cGUucm91dGUgPSBmdW5jdGlvbiggciwgb3B0LCBjYiApIHtcblx0Ly8gc2hpZnQgcGFyYW1zXG5cdGlmKCB0eXBlb2Ygb3B0ID09PSBcImZ1bmN0aW9uXCIgKSB7XG5cdFx0Y2IgPSBvcHQ7XG5cdFx0b3B0ID0ge307XG5cdH1cblxuXHQvLyBleHRyYWN0IHBhcmFtIG5hbWVzIGZyb20gdGhlIHJvdXRlXG5cdHZhciBwYXJhbXMgPSAoIHIubWF0Y2goIC9bQHwlXVxcdysvZyApIHx8IFtdIClcblxuXHRcdC8vIHIubWF0Y2ggZ3JhYnMgcGFyYW0gbmFtZXMgaW5jbHVkaW5nIEAvJSwgc28gdHJpbSB0aGUgZmlyc3QgY2hhclxuXHRcdC5tYXAoIGZ1bmN0aW9uKCB2ICkgeyByZXR1cm4gdi5zdWJzdHIoIDEgKSB9ICk7XG5cblx0Ly8gcmVwbGFjZSBwYXJhbSBuYW1lcyB3aXRoIHJlZ2V4ZXNcblx0dmFyIHJvdXRlID0gci5yZXBsYWNlKCAvQChcXHcrKS9nLCBcIihcXFxcdyspXCIgKVxuXG5cdFx0Ly8gdGhpcyBvbmUgd2FzIGhhcmQgdG8gd3JpdGUuIGl0IGNoZWNrcyBmb3IgMCBvciAxIG9jYy4gb2YgXCIvXCJcblx0XHQvLyBvciwgMCBvciAxIHBhcmFtIChzdHJpbmcsIG5vdCBcIi9cIikgaWYgMSBvY2MuIG9mIFwiL1wiXCIgd2FzIGZvdW5kXG5cdFx0LnJlcGxhY2UoIC9cXC8lKFxcdyspL2csIFwiKD86Lz98LyhcXFxcdyspKVwiICk7XG5cblx0Ly8gd3JhcCB0aGUgcm91dGUgd2l0aCByZWdleHAgc3RyaW5nIGRlbGltaXRlcnNcblx0cm91dGUgPSBcIl5cIiArIHJvdXRlICsgXCIkXCI7XG5cblx0Ly8gdGhyb3cgYW4gZXJyb3IgaWYgdHJ5aW5nIHRvIHJlZGVmaW5lIGEgcm91dGVcblx0aWYoIHR5cGVvZiBnbG9iYWwucm91dGVzW3JvdXRlXSAhPT0gXCJ1bmRlZmluZWRcIiApXG5cdFx0dGhyb3cgbmV3IEVycm9yKCBcIlJvdXRlIGlzIGFscmVhZHkgZGVmaW5lZDogXCIgKyByICk7XG5cblx0Ly8gZGVmaW5lIHRoZSByb3V0ZSBkYXRhIG9iamVjdFxuXHRnbG9iYWwucm91dGVzW3JvdXRlXSA9IHtcblxuXHRcdC8vIHRoZSBvcmlnaW5hbCByb3V0ZSBhcyBkZWZpbmVkIGJ5IHRoZSB1c2VyLCBiZWZvcmUgdG9rZW5zIGFyZVxuXHRcdC8vIGNvbnZlcnRlZCBpbnRvIHJlZ3VsYXIgZXhwcmVzc2lvbnNcblx0XHRyb3V0ZTogcixcblxuXHRcdC8vIHVzZXIgZGVmaW5lZCBjYWxsYmFjayBmb3IgdGhpcyByb3V0ZVxuXHRcdGNhbGxiYWNrOiBjYixcblxuXHRcdC8vIGFuIGFycmF5IG9mIHBhcmFtIG5hbWVzIHRoYXQgYXJlIGRlZmluZWQgd2l0aGluIHRoZSByb3V0ZVxuXHRcdC8vIHRoZXNlIHBhcmFtIG5hbWVzIGFyZSB1c2VkIGxhdGVyIHRvIGNyZWF0ZSBhIGtleS92YWx1ZSBwYWlyIG9mIHBhcmFtc1xuXHRcdC8vIGRlZmluZWQgb24gaW5jb21pbmcgcmVxdWVzdHNcblx0XHRwYXJhbXM6IHBhcmFtcyxcblxuXHRcdC8vIG9wdC5yZXNwb25kZXIgbWF5IGJlIHVuZGVmaW5lZCBhdCB0aGlzIHBvaW50LCBidXQgZG9lc24ndCBzZWVtIHRvXG5cdFx0Ly8gY2F1c2UgYW55IGlzc3Vlcy4gdW5kZWZpbmVkID09PSB1bmRlZmluZWQsIG5iZFxuXHRcdHJlc3BvbmRlcjogb3B0LnJlc3BvbmRlcixcblxuXHRcdC8vIGRlZmF1bHQgdG8gZW1wdHkgYXJyYXkgZm9yIGNvbnZlbmllbmNlIGFuZCB0eXBlIGNvbnNpc3RlbmN5XG5cdFx0bWV0aG9kczogb3B0Lm1ldGhvZHMgfHwgW11cblx0fTtcblxuXHR0aGlzLmVtaXQoIHRoaXMuZXZlbnQucm91dGUsIGdsb2JhbC5yb3V0ZXNbcm91dGVdICk7XG59O1xuXG5cbi8qKlxuICogcHJpbnQgdG8gY29uc29sZSBhbGwgZGVmaW5lZCByb3V0ZXMgKGZvciB0ZXN0aW5nIHB1cnBvc2VzKVxuICovXG5cbkNhbWluby5wcm90b3R5cGUubGlzdCA9IGZ1bmN0aW9uKCkge1xuXHRjb25zb2xlLmxvZyggZ2xvYmFsLnJvdXRlcyApO1xufTtcblxufSkoKTsiXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=