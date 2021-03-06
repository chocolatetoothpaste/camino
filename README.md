# Camino
One-stop routing for server- and client-side web applications

[![NPM](https://nodei.co/npm/camino.png?downloads=true)](https://nodei.co/npm/camino/)

[Support Development](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=4M7XDUZES7DZU)

**Bugs, suggestions, and pull requests welcome! Please submit to GitHub repository**

**Important changes**

With IE 11 usage at a very low percentage (depending on who's data you believe) support will start phasing out to take advantage of es6 features. If you require IE11 support, use version 0.15.x. 

v0.15.0

* In an effort to reduce boilerplate code in browsers, an event listener was added (to window object) to listen for clicks on "A" tags. If the href attribute matches a route defined in camino, the request is routed in the following manner:

```
window.history.pushState( null, null, href );
window.dispatchEvent( new CustomEvent("popstate") );    
event.preventDefault();
```

This may not be the best way to handle it, but it works. Comments/pull requests welcome. This behavior can be turned off by setting the `init` option to false (see docs for setting options). This will also turn off initial firing of popstate event for routing on first page load.

v0.14.0+

* Event firing was changed to use CustomEvent instead of Event constructor to support older version of IE.

* Routes are now sorted using an alogirthm to try and match the most complete or explicit path first. For example, if your request URL is /api/user/data, and you have set up routes for /api/user/%user_id and /api/user/data, it will match /api/user/data first.  This could affect how your existing routes are matched, so test carefully.  Optionally, you can do (psuedo code) `camino.listen([server||window], {sort: false});` to disable sorting.

* Browser: In previous versions, if you attempted to load a request more than once (in a row) the subsequent requests were ignored.  This has been changed so requests are always processed.

* Browser: camino only listens to the popstate event, including for hash updates. The hashchange event is not longer monitored. This means only IE 9+ is supported.

* If you see a bug in the documentation, please report it!

Camino is a request middle layer. It connects requests with callback functions and does not enforce any particular application paradigm. MVC, MVVM, or just write some closures to run some code, Camino doesn't care!

First things first, some juicy examples.

## Usage:
**Server**

    var camino = require("camino");

    // just pretend user.init is part of some controller framework or something
    camino.route( "/api/user/@id", { methods: ["POST"] }, user.init );

    // org.init would be part of the same pretend controller framework
    // passing in some sample options
    camino.route( "/api/organization/@id", {
        responder: SomeCustomResponderObject,
        methods: ["GET", "POST"]
    }, org.init );

    // using the response object
    var callback = function( request ) {
        var data = JSON.stringify({
            status: 200,
            success: true,
            data: request
        });

        // HTTP response object passed from node
        request.response.writeHead( 200, {
            "Content-Length": data.length,
            "Content-Type": "application/json"
        } );

        request.response.end(data);
    };

    // passing in a simple function as the callback for this route
    camino.route( "/api/user/@user_id/message/%id", callback );

    var http = require('http');
    var server = http.createServer().listen(31415, '127.0.0.1');

    camino.listen(server);

**Browser (Hashes)**

    <script src="path/to/camino.js"></script>

    camino.route( "#!/profile", user.init );
    camino.route( "#!/team/@user_id", team.init );

    // using "methods" in the browser
    camino.route( "#!/message/%id", {
        responder: SomeMessageBoxObject,
        methods: ["read", "delete"]
    }, message.init );

    camino.listen(window);
    OR
    camino.listen(window, UIMessageBoxOfSomeKind);

    // using the Camino.event object
    window.addEventListener( camino.event.request, function() {
        // replace page body with a spinner...?
    });

    // browser methods, maybe...?
    // psuedo jQuery code, really terrible example
    $('[data-method]').on( "click", function() {
            // I don't remember if this is frowned upon... not sure if I care
            window.location.method = $(this).data('method');
    });

    // sample html for browser method
    <a href="/#!/message/23" data-method="read">View Message</a>
    <a href="/#!/message/23" data-method="delete">Delete Message</a>

**Browser (History API, condensed example)**

    // include script and define routes
    camino.route( "/profile", user.init );

    camino.route( "#delete", DeleteConfirmationBox );

    // History API is enabled by default
    camino.listen( window );

    // using the Camino.event object
    window.addEventListener( camino.event.request, function() {
        // replace page body with a spinner...?
    });

Then put this in .htaccess

    <ifModule mod_rewrite.c>
        RewriteEngine On
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule (.*) index.html [L]
    </ifModule>

These browser examples are in no way exhaustive, nor "recommended practice". They abstractly illustrate usage. You can choose to support either or both.

* * *

## API
    camino.route( route [, options], callback )

#### route --- String

The URL you are attempting to match. You can also capture "parameters" in your URL by using the @ symbol for a required param, or a % for an optional param. The difference between the two types is, if your URL has a required param but one is not provided, it will result in a (404 error).

**/api/user/%id** matches:

* /api/user
* /api/user/
* /api/user/23

**/api/user/@id** matches:

* /api/user/23

*but not:*

* /api/user
* /api/user/

#### options --- Object

Camino.route accepts 2 options:

**methods** is an array of supported methods for the URL. On the server, this will most likely be request methods. There is nothing built in to work in the browser, so you can devise your own trickery to use this however you want. If you don't pass in a list of allowed methods, any method will be accepted as long as a request matches a route.

**responder** is a custom function/library/whatever that you pass in to handle responses from your callbacks.  If you provide a responder at the route level, it will be used instead of the global response object (if one even exists)

#### callback --- Function

YOUR code that is run when a request is matched to a route. Your callback should accept 2 parameters: a request object, and a response object. The request object is either the http.request object (node.js) or the window.location object (browser), augmented with these additional properties (depending on the presence of matching data):

**request.route** --- an object of route specific data (that you provided) for the matched route. example:

    {
        route: /api/user/@company/%id,

        callback: myCallback,

        // the "params" accepted by the route
        params: [
            "company",
            "id"
        ],

        responder: myResponseObject

        // the array of allowed methods, defaults to empty array for type consistency
        methods: [ ]
    }

**request.path** --- the request string that was used for matching, without query string.  In the browser, this will be either a URL or the hash fragment.

**request.url** --- same as path, but with full query string.

**request.params** --- an object, key-value pair of data extracted from the URLs.

**request.query** --- the query string received by the server, parsed into a JSON object.

**request.qs** --- the original query string. This property should also be added to window.location soon

**request.request** --- the native request object. Node.js: the http.IncomingMessage object, Browser: window.location

**request.response** --- the reponse object. Node.js: http.ServerResponse native object, Browser: whatever you set as the reponder, either globally or per-route

#### Server only:

**request.method** --- a string, in the case of a server the request method. You could augment the window.location object with a "method" in the onclick event or something like that

**request.raw** --- the raw request body (if using built in content-type handlers)

**request.data** --- the request body after it has been parsed (if using built in content-type handlers).

The only built in content types are "application/x-www-form-urlencoded" and "application/json".  If you overwrite these handler, request.raw and request.data will not be set.

In the browser it is possible to augment the location object with additional properties/data you want to pass around.

* * *

    camino.listen( window [, options] [, responder] );

When you call the listen() function, you have the option of passing in a custom "response" object/function.

In the browser, this could be a data parser, a message box, or something like that.

On the server, it defaults to the HTTP response object, but feel free to be creative :) Define your own as a shortcut if you always respond with the same content type or something like that.

The reason for passing through the HTTP response object is to give the user total control over how requests are responded too. The intent of this library is to stay out of the way.

Valid options for camino.listen "options" argument are:

#### Server and Browser:

**sort** --- boolean, if true will sort routes for best possible URL resolution

#### Browser only:

**decode** --- decode query string data using decodeURI, defaults to true

**history** --- use history API for routing requests, defaults to true

**hash** --- listen to hashchange event and handle requests using URL hash, defaults to true

**init** --- boolean value, if true will fire initial events on page load; "popstate" for History API and "hashchange" for hashes.  Leverages the "history" option to determine which ones to fire.

* * *

    camino.handle( type, callback );

Registers a content type and it's corresponding handler.  There are three content types defined by default: multipart/form-data, application/json, and application/x-www-form-urlencoded.  These can easily be overridden with the handle function, as well as additional content types registered depending on your applications needs.

**type** --- String

**callback** --- Function

* * *

    camino.location( location [, data] [, title ] );

Executes a request.  This can be used instead of `window.location` to redirect to a different page.  This is essentially just a wrapper for `history.pushState()` that also fires the popstate event to kick camino into action.  Data and title are optional and correspond directly to the data and title arguments for `history.pushState()`.

* * *

    camino.replace( location [, data] [, title ] );

Works the same as `camino.location()`, but executes `history.replaceState()` instead of `history.pushState()`.

## Events

For convenience, Camino.event container object exists with references to Camino's events. The following are Camino.event's properties:

**request** --- fired when a request is received by Camino

**match** --- fired when a route matching the request is found

**exec** --- fired when the callback is executed

**error** --- fired when an error is encountered

## File Uploads

**(Bad) Exmaple of uploading files from a form**

    camino.handle('multipart/form-data', function( req ) {
        var self = this;
        var Busboy = require( 'busboy' );
        var busboy = new Busboy({ headers: req.request.headers });

        // container for uploaded files. it would be a much better idea to
        // use readstreams instead of buffers stored in memory. just an example
        req.files = {};

        // container for form fields
        req.data = {};

        // grab uploaded files and stream them into buffers
        busboy.on( 'file', function( field, file ) {
            var buf = [];

            file.on( 'data', function(data) {
                // push data chunks into contrainer
                buf.push( data );
            });

            file.on( 'end', function() {
                // when finished capturing data, Buffer it
                req.files[field] = Buffer.concat(buf);

                // blow chunks
                buf = undefined;
            });
        });

        // capture incoming fields as they are parsed
        busboy.on( 'field', function( field, val ) {
            req.data[field] = val;
        });

        busboy.on( 'finish', function() {
            self.emit( self.event.exec );

            // fire off route callback
            req.route.callback.call( null, req );

        });

        // cleansing power of the pipe!
        req.request.pipe( busboy );
    });
