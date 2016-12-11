var gulp = require('gulp');
var replace = require('gulp-replace');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var fs = require('fs');

gulp.task('js', function() {
	var rep = '//=@@include-camino@@';

	var browser = fs.readFileSync('src/browser.js', {encoding: "utf8"});
	var server = fs.readFileSync('src/server.js', {encoding: "utf8"});

	delete require.cache[require.resolve('./package.json')];
	var pkg = require('./package.json');

	gulp.src('src/core.js')
		.pipe(replace(rep, "// node.js specific stuff\n"
			+ "if( typeof module !== \"undefined\" && module.exports ) {\n\t"
			+ server.replace(/\n/g, "\n\t")
			+ "\n\n}\n\n"
			+ "// now the browser stuff\n"
			+ "else {\n\n\t"
			+ browser.replace(/\n/g, "\n\t")
			+ "\n\n}\n"))
		.pipe(replace('//=@@camino-version@@', `'${pkg.version}';`))
		.pipe(concat('camino-all.js'))
		.pipe(gulp.dest('./dist'));

	gulp.src('src/core.js')
		.pipe(replace(rep, browser))
		.pipe(replace('//=@@camino-version@@', `'${pkg.version}';`))
		.pipe(concat('camino-browser.js'))
		.pipe(gulp.dest('./dist'))
		.pipe(uglify())
		.pipe(concat('camino-browser.min.js'))
		.pipe(gulp.dest('./dist'));

	gulp.src('src/core.js')
		.pipe(replace(rep, server))
		.pipe(replace('//=@@camino-version@@', `'${pkg.version}';`))
		.pipe(concat('camino-server.js'))
		.pipe(gulp.dest('./dist'));
});

// Watch Files For Changes
gulp.task('watch', function() {
		gulp.watch(['./src/*.js', './package.json'], ['js']);
});

gulp.task('default', ['js', 'watch']);