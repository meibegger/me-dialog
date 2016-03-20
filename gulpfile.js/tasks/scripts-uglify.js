var gulp = require('gulp')
  , plumber = require('gulp-plumber')
  , uglify = require('gulp-uglify')
  , sourcemaps = require('gulp-sourcemaps')
  , rename = require('gulp-rename')
  , footer = require('gulp-footer')
  , pkg = require('../../package.json')
  , config = require('../config.json')
  , banner = config.scripts.banner || []
  ;

gulp.task('_scripts-uglify', ['scripts-check'], function() {
  console.log(config.scripts.uglify.sourcemap);
  gulp.src(config.scripts.uglify.src)
    .pipe(plumber())
    .pipe(sourcemaps.init())
    .pipe(uglify())
    .pipe(footer('\n'+banner.join('\n'), { pkg : pkg } ))
    .pipe(rename(config.scripts.uglify.rename))
    .pipe(sourcemaps.write('.',config.scripts.uglify.sourcemap))
    .pipe(gulp.dest(config.scripts.dest));

  gulp.src(config.scripts.dest+'/*.js')
    .pipe(footer('\n'+banner.join('\n'), { pkg : pkg } ))
    .pipe(gulp.dest(config.scripts.dest));
});

gulp.task('scripts-uglify',['scripts-check','_scripts-uglify']);
