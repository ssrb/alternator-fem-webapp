var gulp = require('gulp');
var source = require('vinyl-source-stream');
var browserify = require('browserify');
var watchify = require('watchify');
var browserifyShader = require("browserify-shader")
var tsify = require('tsify');
var uglify = require('uglifyify');
var runSequence = require('run-sequence');

gulp.task('.npm.clean', function (cb) {
    var del = require('del');
    del(['node_modules/'], cb);
});

gulp.task('watch', function () {
    var bundler = watchify(browserify({ debug: true })
        .add('alternator.ts')
        .plugin(tsify, { target: 'es5' })
        .transform(browserifyShader));

    bundler.on('update', rebundle)

    function rebundle() {
        return bundler.bundle()
            .pipe(source('bundle.js'))
            .pipe(gulp.dest('.'))
    }

    return rebundle();
});

gulp.task('.ui.debug', function () {
    var bundler = browserify({ debug: true })
        .add('./alternator.ts')
        .plugin(tsify, { target: 'es5' })
        .transform(browserifyShader);

    return bundler.bundle()
        .pipe(source('bundle.js'))
        .pipe(gulp.dest('.'));
});

gulp.task('.ui.release', function () {
    var bundler = browserify()
        .add('./alternator.ts')
        .plugin(tsify, { target: 'es5' })
        .transform(browserifyShader)
        .transform(uglify);

    return bundler.bundle()
        .pipe(source('bundle.js'))
        .pipe(gulp.dest('.'));
});

gulp.task('.solver.debug', function () {
    var bundler = browserify({ debug: true })
        .add('./solver-webworker.ts')
        .plugin(tsify, { target: 'es5' })

    return bundler.bundle()
        .pipe(source('solver-webworker.js'))
        .pipe(gulp.dest('.'));
});

gulp.task('.solver.release', function () {
    var bundler = browserify()
        .add('./solver-webworker.ts')
        .plugin(tsify, { target: 'es5' })
        .transform(uglify);

    return bundler.bundle()
        .pipe(source('solver-webworker.js'))
        .pipe(gulp.dest('.'));
});

gulp.task('default', function (callback) {
    runSequence(
        '.ui.release',
        '.solver.release',
        callback);
});


