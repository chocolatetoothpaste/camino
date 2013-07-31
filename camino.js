(function() {
	var routes = {};
	var root = this;

	// route is a URL or a hash
	// callback is the function to execute when route is matched
	// context is a filter of some kind. GET-POST-PUT-DELETE on the server,
	// arbitrary in the browser
	function Camino( route, callback, context ) {
		routes[route] = { callback: callback, context: context };
	}

	function camino( route, callback, context ) {
		return new Camino( route, callback, context );
	}

	if( typeof module !== 'undefined' && module.exports ) {
		module.exports = route;
	}

	else {
		window.onhashchange = function() {

		}
	}

	root.camino = camino;
})();