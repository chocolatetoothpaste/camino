# Camino
One-stop routing for server- and client-side web applications

[![NPM](https://nodei.co/npm/camino.png?downloads=true)](https://nodei.co/npm/camino/)

**Active development, please submit bugs and suggestions to GitHub repository to make Camino more awesome!!**

**Upcoming breaking change**

* Starting in version 0.12.0, the "request" object will have a new structure with new properties.  Instead of polluting the native object, a new object will be used with the most useful properties and the native object will be wrapped with this new object.  The properties will be renamed to be more consistent with current standards/practices. See documentation when 0.12.0 is released in early 2015.

* Also starting in 0.12.0, the "history" option will default to true.  This can be set to false using the options object.

**Possible breaking changes**

* Starting in v0.11.0, Camino will fire initial events for the browser ("popstate" and/or "hashchange", depending on which ones you option to enable).  See examples below.  This can be overridden with the "init" option.

* Rather than assume most of your users are using an older browser, I have opted to remove any polyfills from the library. This will probably only affect IE users.  For convenience, I have added a Polyfills section to the end of this document.

Camino is a request middle layer. It connects requests with callback functions and does not enforce any particular application paradigm. MVC, MVVM, or just write some closures to run some code, Camino doesn't care!

First things first, some juicy examples.

### Usage:
**Server**

    var camino = require("camino");

    // just pretend user.init is part of some controller framework or something
    camino.route( "/api/user/@id", { methods: ["POST"] }, user.init );

    // org.init would be part of the same pretend controller framework
    // passing in some sample options
    camino.route( "/api/organization/@id", { responder: SomeCustomResponderObject, methods: ["GET", "POST"] }, org.init );

    // using the response object
    var callback = function( map, response ) {
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
    camino.route( "/api/user/@user_id/message/%id", callback );

    var http = require('http');
    var server = http.createServer().listen(31415, '127.0.0.1');

    camino.listen(server);

**Browser (Hashes)**

    <script src="path/to/camino.js"></script>

    camino.route( "#!/profile", user.init );
    camino.route( "#!/team/@user_id", team.init );

    // using "methods" in the browser
    camino.route( "#!/message/%id", { responder: SomeMessageBoxObject, methods: ["read", "delete"] }, message.init );

    camino.listen(window);
    OR
    camino.listen(window, jQueryUIMessageBoxObjectWrapper);

    // using the Camino.event object
    window.addEventListener( camino.event.request, function() {
        // replace page body with a spinner...?
    });

    /**
     * This is no longer required, see History API example below for explanation

    // fire a hashchange event for initial page loads
    window.dispatchEvent( new Event("hashchange") );

     */

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

    camino.route( "#delete", showDeleteConfirmation );

    // how you can conditionally use the History API if available
    camino.listen( window, { history: !!( window.history.pushState ) } );

    /**
     * These two event firings are no longer required if the "init" option is
     * set to true (default). They are left here in the examples so you can see
     * what happens under the hood or so you can override them if desired.

    // fire off route on initial page load
    window.dispatchEvent( new Event('popstate') );

    // hashes and history can live together!
    if( window.location.hash !== '' )
        window.dispatchEvent( new Event('hashchange') );

     */

    // using the Camino.event object
    window.addEventListener( camino.event.request, function() {
        // replace page body with a spinner...?
    });

    // write your own vanilla JS, but here's the super-simple jQuery version
    $( function() {
        $('body').on( {
            click: function(event) {
                window.history.pushState( null, null, this.getAttribute('href') );
                window.dispatchEvent( new Event("popstate") );

                event.preventDefault();
            }
        }, "a:not([href^=\\#])" );
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

### API
    camino.route( route [, options], callback )

**route** --- String

The URL you are attempting to match. You can also capture "parameters" in your URL by using the @ symbol for a required param, or a % for an optional param. The difference between the two types is, if your URL has a required param but one is not provided, it will result in a (404 error).

**/api/user/%id** matches:
/api/user
/api/user/
/api/user/23

**/api/user/@id** matches:
/api/user/23

*but not:*
/api/user
/api/user/

**options** --- Object

Camino.route accepts 2 options:

**methods** is an array of supported methods for the URL. On the server, this will most likely be request methods. In the browser, whatever you want, really...

**responder** is a custom function/library/whatever that you pass in to handle responses from your callbacks.  If you provide a responder at the route level, it will be used instead of the global response object (if one even exists)

If you don't pass in a list of allowed methods, your code will always execute if a request matches a route.  Think of it like methods = "*"

**callback** --- Function

YOUR code that is run when a request is matched to a route. Your callback should accept 2 parameters: a request object, and a response object. The request object is either the http.request object (node.js) or the window.location object (browser), augmented with these additional properties (depending on the presence of matching data):

request.route --- an object of route specific data (that your provided) for the matched route. example:

    {
        // the route
        route: /api/user/@company/%id,

        // the "params" accepted by the route
        params: [
            "company",
            "id"
        ],

        // the array of allowed methods, defaults to empty array for type consistency
        methods: [ ]
    }

request.request --- the request string that was used for matching.

request.params --- an object, key-value pair of data extracted from the URLs.

request.query --- the query string received by the server, parsed into a JSON object.

request.qs --- the original query string. This property should also be added to window.location soon

Node.js only:

request.method --- a string, in the case of a server the request method. You could augment the window.location object with a "method" in the onclick event or something like that

request.raw -- the raw request body

request.data --- the request body after it has been parsed (if using built in content-type handlers).

request.files --- an array of files that were uploaded, captured into Buffers (if applicable)

In the browser it is possible to augment the location object with additional properties/data you want to pass around.

* * *

    camino.listen( server [, responder] ); // Node.js (server)

OR

    camino.listen( window [, options] [, responder] ); // Browser

When you call the listen() function, you have the option of passing in a custom "response" object/function.

In the browser, this could be a data parser, a message box, or something like that.

On the server, it defaults to the HTTP response object, but feel free to be creative :) Define your own as a shortcut if you always respond with the same content type or something like that.

The reason for passing through the HTTP response object is to give the user total control over how requests are responded too. The intent of this library is to stay out of the way.

Valid options for camino.listen "options" (again, browser only) argument are:

**decode** --- decode query string data using decodeURI, defaults to true

**history** --- use history API for routing requests, defaults to false

**hash** --- listen to hashchange event and handle requests using URL hash, defaults to true

**init** --- boolean value, if true will fire initial events on page load; "popstate" for History API and "hashchange" for hashes.  Leverages the "history" option to determine which ones to fire.

* * *

    camino.handle( type, callback );

Registers a content type and it's corresponding handler.  There are three content types defined by default: multipart/form-data, application/json, and application/x-www-form-urlencoded.  These can easily be overridden with the handle function, as well as additional content types registered depending on your applications needs.

**type** --- String

**callback** --- Function

### Events
For convenience, Camino.event container object exists with references to Camino's events. The following are Camino.event's properties:

**request** --- fired when a request is received by Camino

**match** --- fired when a route matching the request is found

**exec** --- fired when the callback is executed

**error** --- fired when an error is encountered

### Error Handling
Very basic error handling was introduced for server instances only.

This was done to handle 404/405 errors to prevent hanging when testing.

Additionally, Camino.error can (should) be augmented/replaced with your own handling of response back to the server.  Look at the default implementation of Camino.error for an idea how to accomplish this.

For browsers the error is logged to the console, so it REALLY should be replaced.

### Polyfills
**CustomEvent**

    // thank you @https://github.com/jonathantneal/EventListener
    // polyfill for using CustomEvent constructor in IE 9/10
    ! window.CustomEvent && (function() {
        window.CustomEvent = function CustomEvent( type, dict ) {
            dict = dict || {
                bubbles: false,
                cancelable: false,
                detail: undefined
            };

            try {
                var ev = document.createEvent('CustomEvent');
                ev.initCustomEvent(
                    type,
                    dict.bubbles,
                    dict.cancelable,
                    dict.detail
                );
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

**Array.forEach**

    // From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach
    if (!Array.prototype.forEach) {

        Array.prototype.forEach = function(callback, thisArg) {

            var T, k;

            if (this == null) {
                throw new TypeError(' this is null or not defined');
            }

            // 1. Let O be the result of calling ToObject passing the |this| value as the argument.
            var O = Object(this);

            // 2. Let lenValue be the result of calling the Get internal method of O with the argument "length".
            // 3. Let len be ToUint32(lenValue).
            var len = O.length >>> 0;

            // 4. If IsCallable(callback) is false, throw a TypeError exception.
            // See: http://es5.github.com/#x9.11
            if (typeof callback !== "function") {
                throw new TypeError(callback + ' is not a function');
            }

            // 5. If thisArg was supplied, let T be thisArg; else let T be undefined.
            if (arguments.length > 1) {
                T = thisArg;
            }

            // 6. Let k be 0
            k = 0;

            // 7. Repeat, while k < len
            while (k < len) {

                var kValue;

                // a. Let Pk be ToString(k).
                //   This is implicit for LHS operands of the in operator
                // b. Let kPresent be the result of calling the HasProperty internal method of O with argument Pk.
                //   This step can be combined with c
                // c. If kPresent is true, then
                if (k in O) {

                    // i. Let kValue be the result of calling the Get internal method of O with argument Pk.
                    kValue = O[k];

                    // ii. Call the Call internal method of callback with T as the this value and
                    // argument list containing kValue, k, and O.
                    callback.call(T, kValue, k, O);
                }

                // d. Increase k by 1.
                k++;
            }
            // 8. return undefined
        };
    }