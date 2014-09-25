var gulp = require('gulp');
// var include = require('gulp-include');
var replace = require('gulp-replace');
var concat = require('gulp-concat');
var fs = require('fs');

gulp.task('js', function() {
	var browser = fs.readFileSync('src/browser.js', {encoding: "utf8"});
	var server = fs.readFileSync('src/server.js', {encoding: "utf8"});

	gulp.src('src/core.js')
		.pipe(replace('//=include', "// node.js specific stuff\n"
			+ "if( typeof module !== \"undefined\" && module.exports ) {\n\t"
			+ server.replace(/\n/g, "\n\t")
			+ "\n\n}\n\n"
			+ "// now the browser stuff\n"
			+ "else {\n\n\t"
			+ browser.replace(/\n/g, "\n\t")
			+ "\n\n}\n"))
		.pipe(concat('camino-all.js'))
		.pipe(gulp.dest('./dist'));

	gulp.src('src/core.js')
		// .pipe( include() )
		.pipe(replace('//=include', browser))
		.pipe(concat('camino-browser.js'))
		.pipe(gulp.dest('./dist'));

	gulp.src('src/core.js')
		.pipe(replace('//=include', server))
		.pipe(concat('camino-server.js'))
		.pipe(gulp.dest('./dist'));
});

// Watch Files For Changes
gulp.task('watch', function() {
		gulp.watch(['./core.js', './server.js', './browser.js'], ['js']);
});

gulp.task('default', ['js', 'watch']);