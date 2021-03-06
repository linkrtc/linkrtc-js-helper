var gulp = require('gulp');
var jshint = require('gulp-jshint');
var sourcemaps = require('gulp-sourcemaps');
var webserver = require('gulp-webserver');
var babel = require('gulp-babel');
var uglify = require('gulp-uglify');

gulp.task('build-dev', function () {
    return gulp.src('src/*.js')
        .pipe(jshint()) // run their contents through jshint
        .pipe(jshint.reporter()) // report any findings from jshint
        .pipe(gulp.dest('testapp/out'));
});

gulp.task('serve-dev', function () {
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

gulp.task('build-dist', function () {
    return gulp.src('src/*.js')
        .pipe(jshint()) // run their contents through jshint
        .pipe(jshint.reporter()) // report any findings from jshint
        .pipe(babel({
            presets: ['es2015']
        }))
        .pipe(sourcemaps.init())
        .pipe(uglify())
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist'));
});
