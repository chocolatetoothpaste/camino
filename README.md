# Camino
One-stop routing for server- and client-side web applications

**Active development, please submit bugs and suggestions to GitHub repository to make Camino more awesome!!**

**Possible breaking change:**
Rather than assume most of your users are using an older browser, I have opted to remove any polyfills from the library. This will probably only affect IE users.  For convenience, I have added a Polyfills section to the end of this document.

Camino is a request middle layer. It connects requests with callback functions and does not enforce any particular application paradigm. MVC, MVVM, or just write some closures to run some code, Camino doesn't care!

First things first, some juicy examples.

### Usage:
**Server**

    var camino = require("camino");

    // just pretend user.init is part of some controller framework or something
    camino.route( "/api/user/@id", { methods: ["POST"] }, user.init );

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

    // org.init would be part of the same pretend controller framework
    // passing in some sample options
    camino.route( "/api/organization/@id", { responder: SomeCustomResponderObject, methods: ["GET", "POST"] }, org.init );

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

    camino.route( "#delete", showDeleteConfirmation );

    camino.listen( window, { history: true } );

    // fire off route on initial page load
    window.dispatchEvent( new Event('popstate') );

    // hashes and history can live together!
    if( window.location.hash !== '' )
        window.dispatchEvent( new Event('hashchange') );

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

request.data --- the request body, from a HTML form for example, and should be ignored for get request since many servers will drop it in transmission. Again, this could be augmented with an "onclick" event if you want to pass around data

request.files --- an array of files that were upload, captured into Buffers

I would strongly recommend passing file uploads as a base64 encoded string in your JSON payload. It works better and keeps your data payload more organized.

* * *

    camino.listen( server [, responder] );

OR

    camino.listen( window [, options] [, responder] ); // Browser only

When you call the listen() function, you have the option of passing in a custom "response" object/function.

In the browser, this could be a data parser, a message box, or something like that.

On the server, it defaults to the HTTP response object, but feel free to be creative :) Define your own as a shortcut if you always respond with the same content type or something like that.

The reason for passing through the HTTP response object is to give the user total control over how requests are responded too. The intent of this library is to stay out of the way.

Valid options for camino.listen "options" argument are:

**decode** --- decode query string data using decodeURI, defaults to true

**history** --- use history API for routing requests, defaults to false

**hash** --- listen to hashchange event and handle requests using URL hash, defaults to true

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

Additionally, Camino.error can (read: should) be augmented/replaced with your own handling of response back to the server.  Take a peak at the code for an idea how to accomplish this, and maybe add your own browser error handler while you're at it.

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