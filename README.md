# Camino - One-stop routing for server- and client-side web applications
### History API support has been added, but currently does not "fallback" to hashes.  Support for this will come likely in the next version, unless there's a reason to not do this at all
### req.body is being renamed req.data, please update your code now. req.body will exist for a couple more version, but will go the way of the dodo. req.data is more ubiquitus with terms developers currently use.

**Active development, please submit bugs and suggestions to GitHub repository!**

**Camino only routes requests to a callback, it is not a full-fledged REST API server or any such sort. It's only job is to dispatch requests.**

### Defining Routes
    camino.route( route [, options], callback )

**route**
type: string

The URL you are attempting to match. You can also capture "parameters" in your URL by using the @ symbol for a required param, or a % for an optional param. The difference between the 2 is, if your URL contains a required param but one is not passed, it will result in a non-match.

/api/user/%id matches /api/user, /api/user/ and /api/user/23

/api/user/@id matches /api/user/23, but not /api/user or /api/user/

**options**
type: object

context (string) parameter is how you distinguish what type of request is being made. On the server, this is typically the request method. In the browser, who knows? Maybe we'll figure something out one day...

If you don't pass in a context, your code will always execute if a request matches a route.
responder (function) is a custom responder to use in place of the default (if there is one) for a single route

**callback**
type: function

YOUR code that is run when a request is matched to a route.

See callback section below for usage.

<!-- Lastly, the responder param is an object you want to use in your code to send a message to the browser/server/anything else. It can be whatever you want and do whatever you want. On the server, it defaults to the HTTP response object so you can set headers, write data, anything else. This can be overriden on a route by route basis, or globally through the listen() function. See examples below. -->
### Callback
Your callback should accept 2 parameters: a map object, and a response object.

The map object is either the http.request object (node) or the window.location object (browser), augmented with 4 additional properties: query, context, params, data.

map.query: the query string received by the server

map.context: a string, in the case of a server GET, POST, PUT, DELETE, etc... whatever you want really.

map.params: an object, key-value pair of data extracted from the URLs.

map.data: the request body, from a HTML for example, and should be ignored for get request since many servers will drop it in transmission.

### Listening
When you call the listen() function, you have the option of passing in a custom "response" object/function.

In the browser, this could be a data parser, a message box, or something like that.

On the server, it defaults to the HTTP response object, but feel free to be creative :) Define your own as a shortcut if you always respond with the same content type or something like that.

The reason for passing through the HTTP response object is to give the user total control over how requests are responded too. The intent of this library is to stay out of the way.

### Error Handling
Very basic error handling was introduced for server instances only.

This was done to handle 4XX errors so browser hanging can be avoided.

Crappy error handling has been replaced with events now, so take full advantage of that.

Additionally, Camino.error can be augmented with your own handling of response back to the server.  Take a peak at the code for an idea how to accomplish this, and maybe add your own browser error handler while you're at it.

### Usage:

Server

    var camino = require("camino");

    camino.route( "/api/user/@id", { context: ["POST"] }, user.init );

    // using the response object
    var myCb = function( map, response ) {
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
    };

    camino.route( "/api/user/@user_id/message/%id", myCb );

    // supplying "options" to the route, with custom responder
    var options = { responder: SomeCustomResponder, context: ["GET", "POST"] };
    camino.route( "/api/organization/@id", options, org.init );

    var http = require('http');
    var server = http.createServer().listen(31415, '127.0.0.1');

    camino.listen(server);

Browser (Hashes)

    <script src="path/to/camino.js"></script>
    // var camino = camino() is no longer required

    camino.route( "#!/profile", user.init );
    camino.route( "#!/team/@user_id", team.init );

    // this route will override the default CustomResponderObject set below with different responders
    camino.route( "#!/video:%playlist_id", { responder: SomeDataDisplayingObject }, playlist.init);

    // possible context...?  see "browser context" comment below
    var options = { responder: SomeMessageBoxObject, context: ["read", "delete"] };
    camino.route( "#!/message/%id", options, message.init );

    camino.listen(window);
    OR
    camino.listen(window, CustomResponderObject);

    // fire a hashchange event for initial page loads
    window.dispatchEvent( new Event("hashchange") );

    // browser context, maybe...?
    // psuedo jQuery code
    $('[data-context]').on( "click", function() {
            // I don't remember if this is frowned upon... not sure if I care
            window.location.context = $(this).data('context');
    });

    // sample html for browser context
    <a href="/#!/message/23" data-context="read">View Message</a>
    <a href="/#!/message/23" data-context="delete">Delete Message</a>

Using the History API requires a bit more boilerplate code, but works quite nicely

Browser (History API, condensed example)

    // include script and define routes

    camino.listen( window, { history: !!( window.history.pushState ) } ); // or just set it to true if you like

    // write your own vanilla JS, but here's the super-simple jQuery version
    $( function() {
        $('body').on( {
            click: function(event) {
                window.history.pushState( null, null, this.getAttribute('href') );
                window.dispatchEvent( new Event("popstate") );

                event.preventDefault();
            }
        }, "a" );
    } );

Then put his in .htaccess

    <ifModule mod_rewrite.c>
        RewriteEngine On
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule (.*) index.html [L]
    </ifModule>