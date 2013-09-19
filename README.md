# Camino - One-stop routing for server- and client-side web applications
### Active development, please submit bugs and suggestions to GitHub repository!

#### Example usage:

###### Server
    var camino = require('./camino')();

    camino.route( "/api/user/@id", user.init );
    camino.route( "/api/user/@user_id/image", function() {
        // run code to get user images from static file storage...
    }, [ "GET", "POST" ] );
    camino.route( "/api/organization/@id", org.init, [ "GET", "POST" ] );

    var http = require('http');
    var server = http.createServer().listen(1337, '127.0.0.1');

    camino.listen(server);

###### Browser
    var camino = camino();

    camino.route( "#!/profile", user.init );
    camino.route( "#!/team/@user_id", team.init );
    camino.route( "#!/video:%playlist_id", playlist.init );

    camino.listen(window);

    // fire a hashchange event for initial page loads
    window.dispatchEvent( new Event("hashchange") );

Note: contexts in the browser are arbitrarily derived, until such a time as any are discovered. Please submit suggestions to GitHub repository.
Crappy examples, but you get the point.