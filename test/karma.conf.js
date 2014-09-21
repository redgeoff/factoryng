// Karma configuration
// http://karma-runner.github.io/0.12/config/configuration-file.html
// Generated on 2014-08-21 using
// generator-karma 0.8.3

module.exports = function(config) {
  'use strict';

  config.set({
    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,

    // base path, that will be used to resolve files and exclude
    basePath: '../',

    // testing framework to use (jasmine/mocha/qunit/...)
    frameworks: ['jasmine'],

    // list of files / patterns to load in the browser
    files: [
      'bower_components/es5-shim/es5-shim.js',
      'node_modules/jasmine-as-promised/src/jasmine-as-promised.js',
      'bower_components/angular/angular.js',
      'bower_components/angular-mocks/angular-mocks.js',
      'bower_components/angular-resource/angular-resource.js',
      'bower_components/angular-route/angular-route.js',
      'bower_components/q/q.js',
      'node_modules/events/events.js',
//'node_modules/request/request.js',
//      'bower_components/jquery/dist/jquery.js',
      'bower_components/pouchdb/dist/pouchdb.js',
      'bower_components/delta-pouch/dist/pouchdb.delta-pouch.js',
      'bower_components/firebase/firebase.js',
      'scripts/yng-utils.js', // need to load yngutils first to setup module
      'test/spec/yng-adapter.js',
      'scripts/**/*.js',
      // 'test/mock/**/*.js',
      'test/spec/**/*.js'
    ],

    // list of files / patterns to exclude
    exclude: ['scripts/adapters/templatyng.js', 'test/spec/adapters/templatyng.js'],

    // web server port
    port: 8080,

    // Start these browsers, currently available:
    // - Chrome
    // - ChromeCanary
    // - Firefox
    // - Opera
    // - Safari (only Mac)
    // - PhantomJS
    // - IE (only Windows)
    browsers: [
     'PhantomJS'
      // 'Chrome'
    ],

    // Code coverage report
    reporters: ['progress', 'coverage'],  
    preprocessors: {  
      'scripts/**/!(templatyng).js': ['coverage']
    },
    coverageReporter: {  
      // type: 'html',
      type: 'lcov',
      // type: 'cobertura',
      dir: 'coverage',
      subdir: function(browser) {
        // normalization process to keep a consistent browser name accross different
        // OS
        return browser.toLowerCase().split(/[ /-]/)[0];
      }
    },

    // Which plugins to enable
    plugins: [
      'karma-phantomjs-launcher',
      // 'karma-chrome-launcher',
      'karma-jasmine',
      'karma-coverage'
    ],

    // Continuous Integration mode
    // if true, it capture browsers, run tests and exit
    singleRun: false,

    colors: true,

    // level of logging
    // possible values: LOG_DISABLE || LOG_ERROR || LOG_WARN || LOG_INFO || LOG_DEBUG
    logLevel: config.LOG_INFO,

    // Uncomment the following lines if you are using grunt's server to run the tests
    // proxies: {
    //   '/': 'http://localhost:9000/'
    // },
    // URL root prevent conflicts with the site root
    // urlRoot: '_karma_'

    browserNoActivityTimeout: 100000 // Needed for propagation testing
  });
};
