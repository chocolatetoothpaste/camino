# Camino - One-stop routing for server- and client-side web applications
## API recently changed, require("camino")(); is no longer required (under Node.js), nor is var camino = camino() (in the browser). Just require("camino");, or script src in the browser.  Sorry if this screws up anyone's code.
### Active development, please submit bugs and suggestions to GitHub repository!

### Camino only routes requests to a callback, it is not a full-fledged REST API server or any such sort. It's only job is to dispatch requests.

#### Example usage:

##### Your callback should accept 3 parameters, context, params, and data. context is a string, in the case of a server GET, POST, PUT, DELETE, etc... whatever you want really.  params is an object, key-value pair of data extracted from the URLs.  data is the request body, from a HTML for example, and should be ignored for get request since many servers will drop it in transmission.

##### @param translates to a "required" parameter for the URL, %param is an optional param. If a URL contains a required param and one is not passed, it behaves as the the route has not been defined (404, in HTTP terms).

###### Server
    var camino = require('./camino');

    camino.route( "/api/user/@id", user.init );
    camino.route( "/api/user/@user_id/image", function( context, params, data ) {
    	// check that context is one this URL accepts, process params...
        // run code to get user images from static file storage...
    }, [ "GET", "POST", "PUT", "DELETE" ] );
    camino.route( "/api/organization/@id", org.init, [ "GET", "POST" ] );

    var http = require('http');
    var server = http.createServer().listen(1337, '127.0.0.1');

    camino.listen(server);

###### Browser
    <script src="path/to/camino.js"></script>

    camino.route( "#!/profile", user.init );
    camino.route( "#!/team/@user_id", team.init );
    camino.route( "#!/video:%playlist_id", playlist.init );

    camino.listen(window);

    // fire a hashchange event for initial page loads
    window.dispatchEvent( new Event("hashchange") );

Note: contexts in the browser are arbitrarily derived, until such a time as any are discovered. Please submit suggestions to GitHub repository.
Crappy examples, but you get the point.