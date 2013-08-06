# Camino.js - One-stop routing for the server and browser; look no further!
## Active development, please submit bugs and suggestions to GitHub repository!

#### Example usage:

###### Server
This would be nice, and is the goal, but not quite there yet:

    camino().route( "/api/user/@id", user.init, "*" );
    camino().route( "/api/user/@user_id/image", function() {
	    // run code to get user images from static file storage...
    }, [ "GET", "POST" ] );
    camino().route( "/api/organization/@id", org.init, [ "GET", "POST" ] );

    camino().listen();

###### Browser
    camino().route( "#!/profile", user.init );
    camino().route( "#!/team/@user_id", team.init );
    camino().route( "#!/video:%playlist_id", playlist.init );

    camino().listen();

Note: contexts in the browser are arbitrarily derived, until such a time as any are discovered. Please submit suggestions to GitHub repository.
Crappy examples, but you get the point.