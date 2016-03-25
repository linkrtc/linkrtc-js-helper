const gulp = require('gulp');
const jshint = require('gulp-jshint');
const sourcemaps = require('gulp-sourcemaps');
const webserver = require('gulp-webserver');


gulp.task('devel-build', function() {
    return gulp.src('src/*.js')
        .pipe(jshint()) // run their contents through jshint
        .pipe(jshint.reporter()) // report any findings from jshint
        .pipe(gulp.dest('testapp/out'));
});


gulp.task('devel-serve', function() {
    gulp.src('testapp')
        .pipe(webserver({
            livereload: true,
            directoryListing: {
                enable: false,
                path: 'testapp'
            },
            open: true
        }));
});

gulp.task('build', function() {
    return gulp.src('src/*.js')
        .pipe(sourcemaps.init())
        .pipe(jshint()) // run their contents through jshint
        .pipe(jshint.reporter()) // report any findings from jshint
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist'));
});
