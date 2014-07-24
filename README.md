# Camino
One-stop routing for server- and client-side web applications

**Active development, please submit bugs and suggestions to GitHub repository to make Camino more awesome!!**

**The documentation was wrong for a while, sorry to everyone who was probably super confused/pissed**

Camino is a request middle layer.

First things first, some juicy examples.

### Usage:

**Server**

    var camino = require("camino");

    // just pretend user.init is part of some controller framework or something
    camino.route( "/api/user/@id", { methods: ["POST"] }, user.init );

    // using the response object
    var myCb = function( map, response ) {
        var data = JSON.stringify({
            status: 200,
            success: true,
            data: map
        });

        // HTTP response object passed from node
        response.writeHead( 200, {
            "Content-Length": data.length,
            "Content-Type": "application/json"
        } );

        response.end(data);
    };

    // passing in a simple function as the callback for this route
    camino.route( "/api/user/@user_id/message/%id", myCb );

    // org.init would be part of the same pretend controller framework
    // passing in some sample options
    camino.route( "/api/organization/@id", { responder: SomeCustomResponderObject, methods: ["GET", "POST"] }, org.init );

    var http = require('http');
    var server = http.createServer().listen(31415, '127.0.0.1');

    camino.listen(server);

**Browser (Hashes)**

    <script src="path/to/camino.js"></script>
    // var camino = camino() is no longer required

    camino.route( "#!/profile", user.init );
    camino.route( "#!/team/@user_id", team.init );

    // using "methods" in the browser
    camino.route( "#!/message/%id", { responder: SomeMessageBoxObject, methods: ["read", "delete"] }, message.init );

    camino.listen(window);
    OR
    camino.listen(window, jQueryUIMessageBoxObjectWrapper);

    // fire a hashchange event for initial page loads
    window.dispatchEvent( new Event("hashchange") );

    // browser methods, maybe...?
    // psuedo jQuery code
    $('[data-method]').on( "click", function() {
            // I don't remember if this is frowned upon... not sure if I care
            window.location.method = $(this).data('method');
    });

    // sample html for browser method
    <a href="/#!/message/23" data-method="read">View Message</a>
    <a href="/#!/message/23" data-method="delete">Delete Message</a>

Using the History API requires a bit more boilerplate code, but works quite nicely

**Browser (History API, condensed example)**

    // include script and define routes
    camino.route( "/profile", user.init );

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

Then put this in .htaccess

    <ifModule mod_rewrite.c>
        RewriteEngine On
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule (.*) index.html [L]
    </ifModule>

* * *

### API
    camino.route( route [, options], callback )

**route** --- string

The URL you are attempting to match. You can also capture "parameters" in your URL by using the @ symbol for a required param, or a % for an optional param. The difference between the 2 is, if your URL contains a required param but one is not passed, it will result in a non-match (404 error).

/api/user/%id matches /api/user, /api/user/ and /api/user/23

/api/user/@id matches /api/user/23, but not /api/user or /api/user/

**options** --- Object

Camino only uses 2 options **methods** (string) and **reponsder** (function)

**methods** is an array of supported methods for the URL. On the server, this will most likely be request methods. In the browser, whatever you want, really...

**responder** is a custom function/library/whatever that you pass in to handle responses from your callbacks.  If you provide a responder at the route level, it will be used instead of the global response object (if one even exists)

If you don't pass in a list of allowed methods, your code will always execute if a request matches a route.  Think of it like methods = "*"

**callback** --- Function

YOUR code that is run when a request is matched to a route. Your callback should accept 2 parameters: a request object, and a response object. The request object is either the http.request object (node.js) or the window.location object (browser), augmented with these additional properties (depending on the presence of matching data):

request.route --- an object of route specific data (that your provided) for the matched route. example:

    {
		route: /api/user/@company/%id,		// the route as defined by user (since the regex version is probably of no use)
		params: [							// the "params" accepted by the route
			"company",
			"id"
		],
		methods: [ ]						// the array of allowed methods, defaults to empty array for type consistency
	}

request.request --- the request string that was used for matching.
request.params --- an object, key-value pair of data extracted from the URLs.
request.query --- the query string received by the server, parsed into a JSON object.
request.qs --- the original query string. This property should also be added to window.location soon

Node.js only:

request.method --- a string, in the case of a server the request method. You could augment the window.location object with a "method" in the onclick event or something like that
request.data --- the request body, from a HTML form for example, and should be ignored for get request since many servers will drop it in transmission. Again, this could be augmented with an "onclick" event if you want to pass around data
request.files --- an array of files that were upload, captured into Buffers

I would strongly recommend passing file uploads as a base64 encoded string in your JSON payload. It works better and keeps your data payload more organized.

* * *

    camino.listen( server [, responder] );

OR

    camino.listen( window [, options] [, responder] );

When you call the listen() function, you have the option of passing in a custom "response" object/function.

In the browser, this could be a data parser, a message box, or something like that.

On the server, it defaults to the HTTP response object, but feel free to be creative :) Define your own as a shortcut if you always respond with the same content type or something like that.

The reason for passing through the HTTP response object is to give the user total control over how requests are responded too. The intent of this library is to stay out of the way.

### Error Handling
Very basic error handling was introduced for server instances only.

This was done to handle 4XX errors so browser hanging can be avoided.

Crappy error handling has been replaced with events now, so take full advantage of that.

Additionally, Camino.error can (read: should) be augmented/replaced with your own handling of response back to the server.  Take a peak at the code for an idea how to accomplish this, and maybe add your own browser error handler while you're at it.

### Changelog
I'm not that good, maybe someday...