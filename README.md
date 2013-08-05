# Camino.js - Sensible routing for the server and browser
## Active developmnet, please submit bugs and suggestions to github repository!

#### Example usage:

###### Server
`camino().route( '/api/user/@id', user.init, '*' );
camino().route( '/api/user/@user_id/image', function() {
	// run code to get user images from static file storage...
}, [ 'GET', 'POST' ] );
camino().route( '/api/organization/@id', org.init, [ 'GET', 'POST' ] );

camino().listen();`

###### Browser
Note: contexts in the browser are arbitrarily derived, until such a time as any are discovered. Please submit suggestions to github repository.
`camino().route( '#!/profile', user.init );
camino().route( '#!/team/@user_id', team.init );
camino().route( '#!/video:%playlist_id', playlist.init );

camino().listen();`

Crappy examples, but you get the point.