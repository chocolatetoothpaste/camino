# Camino - One-stop routing for server- and client-side web applications
## Breaking API change for release 0.5.0, see examples below
### Active development, please submit bugs and suggestions to GitHub repository!

### Camino only routes requests to a callback, it is not a full-fledged REST API server or any such sort. It's only job is to dispatch requests.

##### Defining Routes
    camino.route( route [, options], callback )

###### route
type: string
The URL you are attempting to match. You can also capture "parameters" in your URL by using the @ symbol for a required param, or a % for an optional param. The difference between the 2 is, if your URL contains a required param but one is not passed, it will result in a non-match.
/api/user/%id matches /api/user, /api/user/ and /api/user/23
/api/user/@id matches /api/user/23, but not /api/user

###### options
type: object
context (string) parameter is how you distinguish what type of request is being made. On the server, this is typically the request method. In the browser, who knows? Maybe we'll figure something out one day...
If you don't pass in a context, your code will always execute if a request matches a route.

responder (function) is a custom responder to use in place of the default (if there is one) for a single route

###### callback
type: function
YOUR code that is run when a request is matched to a route.
See callback section below for usage.

<!-- Lastly, the responder param is an object you want to use in your code to send a message to the browser/server/anything else. It can be whatever you want and do whatever you want. On the server, it defaults to the HTTP response object so you can set headers, write data, anything else. This can be overriden on a route by route basis, or globally through the listen() function. See examples below. -->

##### Callback
Your callback should accept 2 parameters: a map object, and a response object.

The map object contains 4 properties: query, context, params, data.
map.query: the query string received by the server
map.context: a string, in the case of a server GET, POST, PUT, DELETE, etc... whatever you want really.
map.params: an object, key-value pair of data extracted from the URLs.
map.data: the request body, from a HTML for example, and should be ignored for get request since many servers will drop it in transmission.

##### Listening
When you call the listen() function, you have the option of passing in a custom "response" object/function.
In the browser, this could be a data parser, a message box, or something like that.
On the server, it defaults to the HTTP response object, but feel free to be creative :) Define your own as a shortcut if you always respond with the same content type or something like that.
The reason for passing through the HTTP response object is to give the user total control over how requests are responded too. The intent of this library is to stay out of the way.

#### Usage:

Server

    var camino = require("camino"); // changed from require("camino")();

    camino.route( { route: "/api/user/@id", context: ["POST"] }, user.init );

    // using the response object
    camino.route( "/api/user/@user_id/message/%id"
        function( map, response ) {
        var data = {
            status: 200,
            success: true,
            data: map
        };

        data = JSON.stringify( data );

        // HTTP response object passed from node
        response.writeHead( 200, {
            "Content-Length": data.length,
            "Content-Type": "application/json"
        } );

        response.end(data);
    } );

    // first param as string (no context), with callback, and custom responder
    camino.route( "/api/organization/@id", { responder: SomeCustomResponder }, org.init );

    var http = require('http');
    var server = http.createServer().listen(31415, '127.0.0.1');

    camino.listen(server);

Browser

    <script src="path/to/camino.js"></script>
    // var camino = camino() is no longer required

    camino.route( "#!/profile", user.init );
    camino.route( "#!/team/@user_id", team.init );

    // these 2 routes will override the default CustomResponderObject set below with different responders
    camino.route( "#!/message/%id", { responder: SomeDataDisplayingObject }, message.init );
    camino.route( "#!/video:%playlist_id", { responder: SomeMessageBoxObject }, playlist.init);

    camino.listen(window);
    OR
    camino.listen(window, CustomResponderObject);

    // fire a hashchange event for initial page loads
    window.dispatchEvent( new Event("hashchange") );

Note: contexts could be anything in the browser, so if anyone has some good use-case arguments, I'd love to hear them.