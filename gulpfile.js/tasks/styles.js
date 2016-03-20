var gulp = require('gulp')
  , plumber = require('gulp-plumber')
  , gulpif = require('gulp-if')
  , header = require('gulp-header')
  , csso = require('gulp-csso')
  , prefix = require('gulp-autoprefixer')
  , sass = require('gulp-sass')
  , sourcemaps = require('gulp-sourcemaps')
  , pkg = require('../../package.json')
  , config = require('../config.json')
  , banner = config.styles.banner || []
;

gulp.task('styles', function () {
  gulp.src(config.styles.root)
    .pipe(plumber())
    .pipe(sourcemaps.init())
    .pipe(sass().on('error', sass.logError))
    .pipe(prefix(config.styles.browsers))
    .pipe(csso())
    .pipe(sourcemaps.write('./'))
    .pipe(header(banner.join('\n'), { pkg : pkg } ))
    .pipe(gulp.dest(config.styles.dest));
});
