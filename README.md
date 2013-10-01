# Camino - One-stop routing for server- and client-side web applications
## API recently changed, see examples below for proper usage.
### Active development, please submit bugs and suggestions to GitHub repository!

### Camino only routes requests to a callback, it is not a full-fledged REST API server or any such sort. It's only job is to dispatch requests.

#### Example usage:

##### Your callback should accept 4 parameters, context, params, data, and another callback.
###### context is a string, in the case of a server GET, POST, PUT, DELETE, etc... whatever you want really.
###### params is an object, key-value pair of data extracted from the URLs.
###### data is the request body, from a HTML for example, and should be ignored for get request since many servers will drop it in transmission.
###### callback is what you pass your data into after your code has run, so under Node it can be passed to the response object and sent to the requester. this behavior will likely extend to the browser in the near future.

##### @param translates to a "required" parameter for the URL, %param is an optional param. If a URL contains a required param and one is not passed, it behaves as the the route has not been defined (404, in HTTP terms).
##### What to return: an object, with at least 2 properties--status and success.  Status should be a HTTP status code, and success should be a boolean value.  Other than that, you can include a message, maybe a data property with data from your server.  I even like to send a debug property with some great info when working under a dev environment.

###### Server
    var camino = require("camino"); // changed from require("camino")();

    camino.route( "/api/user/@id", user.init );
    camino.route( "/api/user/@user_id/image/%id", function( context, params, data, callback ) {
    	// check that context is one this URL accepts, process params...
        // run code to get user images from static file storage...
        callback( { some: "data" } );
    }, [ "GET", "POST", "PUT", "DELETE" ] );
    camino.route( "/api/organization/@id", org.init, [ "GET", "POST" ] );

    var http = require('http');
    var server = http.createServer().listen(31415, '127.0.0.1');

    camino.listen(server);

###### Browser
    <script src="path/to/camino.js"></script>
    // var camino = camino() is no longer required

    camino.route( "#!/profile", user.init );
    camino.route( "#!/team/@user_id", team.init );
    camino.route( "#!/message/%id", message.init );
    camino.route( "#!/video:%playlist_id", playlist.init );

    camino.listen(window);

    // fire a hashchange event for initial page loads
    window.dispatchEvent( new Event("hashchange") );

Note: contexts could be anything in the browser, so if anyone has some good use-case arguments, I'd love to hear them.