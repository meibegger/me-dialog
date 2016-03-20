
var gulp = require('gulp')
  , extend = require('extend')
  , requirejs = require('requirejs')
  , header = require('gulp-header')
  , footer = require('gulp-footer')
  , pkg = require('../../package.json')
  , config = require('../config.json')
  , banner = config.scripts.banner || []
;


function constructRequireTasks (requireConfig,name,suffix) {

  var taskSuffix = name ? '-'+name : '';
  suffix = suffix || '';

  gulp.task('scripts-requirejs'+taskSuffix, ['scripts-check'], function (taskReady) {
    var rConf = {}
      , fName = requireConfig.out + suffix + '.js';
    extend (true, rConf, requireConfig, {
      out: fName,
      optimize: 'none'
    });

    requirejs.optimize(rConf, function () {
      gulp.src(rConf.out)
        .pipe(header(banner.join('\n'), { pkg : pkg } ))
        .pipe(gulp.dest(config.scripts.dest));

      taskReady();

    }, function (error) {
      console.error('requirejs task failed', JSON.stringify(error))
      process.exit(1);
    });
  });

  gulp.task('scripts-requirejs'+taskSuffix+'-min', ['scripts-check'], function (taskReady) {
    var rConf = {}
      , fName = requireConfig.out + suffix + '.min.js';
    extend (true, rConf, requireConfig, {
      out: fName,
      optimize: 'uglify2',
      generateSourceMaps: true,
      preserveLicenseComments: false
    });

    requirejs.optimize(rConf, function () {
      gulp.src(rConf.out)
        .pipe(footer('\n'+banner.join('\n'), { pkg : pkg } ))
        .pipe(gulp.dest(config.scripts.dest));

      taskReady();

    }, function (error) {
      console.error('requirejs task failed', JSON.stringify(error))
      process.exit(1);
    });
  });

  gulp.task('scripts-require'+taskSuffix,['scripts-check','scripts-requirejs'+taskSuffix]);
  gulp.task('scripts-require'+taskSuffix+'-min',['scripts-check','scripts-requirejs'+taskSuffix+'-min']);

}


if (Array.isArray(config.scripts.require)) { // multiple require js bundle confs
  for (var i=0; i<config.scripts.require.length; i++) {
    var requireConfig = config.scripts.require[i];

    constructRequireTasks(
      requireConfig.options,
      requireConfig.hasOwnProperty('name') ? requireConfig.name : '',
      requireConfig.hasOwnProperty('suffix') ? requireConfig.suffix : ''
    );

  }

} else { // single require js conf
  constructRequireTasks(config.scripts.require)
}

