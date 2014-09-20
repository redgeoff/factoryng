'use strict';

// # Globbing
// for performance reasons we're only matching one level down:
// 'test/spec/{,*/}*.js'
// use this if you want to recursively match all subfolders:
// 'test/spec/**/*.js'

module.exports = function (grunt) {

  // Load grunt tasks automatically
  require('load-grunt-tasks')(grunt);

  // Time how long tasks take. Can help when optimizing build times
  require('time-grunt')(grunt);

  // Configurable paths
  var appConfig = {
    scripts: 'scripts',
    dist: 'dist',
    examples: 'examples'
  };

  // Define the configuration for all the tasks
  grunt.initConfig({

    // Project settings
    factoryng: appConfig,

    // Watches files for changes and runs tasks based on the changed files
    watch: {
      bower: {
        files: ['bower.json'],
        tasks: ['wiredep']
      },
      js: {
        files: ['<%= factoryng.scripts %>/{,*/}*.js'],
        tasks: ['newer:jshint:all'],
        options: {
          livereload: '<%= connect.options.livereload %>'
        }
      },
      jsTest: {
        files: ['test/spec/{,*/}*.js'],
        tasks: ['newer:jshint:test', 'karma']
      },
      gruntfile: {
        files: ['Gruntfile.js']
      },
      livereload: {
        options: {
          livereload: '<%= connect.options.livereload %>'
        },
        files: [
          '<%= factoryng.examples %>/{,*/}*.html'
        ]
      }
    },

    // The actual grunt server settings
    connect: {
      options: {
        port: 9000,
        // Change this to '0.0.0.0' to access the server from outside.
        hostname: 'localhost',
        livereload: 35729
      },
      livereload: {
        options: {
          open: true,
          middleware: function (connect) {
            return [
              connect().use(
                '/dist',
                connect.static('./dist')
              ),
              connect().use(
                '/coverage',
                connect.static('./coverage/phantomjs/lcov-report')
              ),
              connect.static(appConfig.examples)
            ];
          }
        }
      },
      test: {
        options: {
          port: 9001,
          middleware: function (connect) {
            return [
              connect.static('.tmp'),
              connect.static('test'),
              connect().use(
                '/bower_components',
                connect.static('./bower_components')
              ),
              connect.static(appConfig.examples)
            ];
          }
        }
      },
      dist: {
        options: {
          open: true,
          base: '<%= factoryng.dist %>'
        }
      }
    },

    // Make sure code styles are up to par and there are no obvious mistakes
    jshint: {
      options: {
        jshintrc: '.jshintrc',
        reporter: require('jshint-stylish')
      },
      all: {
        src: [
          'Gruntfile.js',
          '<%= factoryng.scripts %>/{,*/}*.js',
          '!<%= factoryng.scripts %>/adapters/templatyng.js'
        ]
      },
      examples: {
        src: [
          '<%= factoryng.examples %>/{,*/}*.js',
          '!<%= factoryng.examples %>/projects/ocLazyLoad.min.js'
        ]
      },
      test: {
        options: {
          jshintrc: 'test/.jshintrc'
        },
        src: ['test/spec/{,*/}*.js']
      }
    },

    // Empties folders to start fresh
    clean: {
      dist: {
        files: [{
          dot: true,
          src: [
            '.tmp',
            '<%= factoryng.dist %>/{,*/}*',
            '!<%= factoryng.dist %>/.git*'
          ]
        }]
      },
      server: '.tmp',
      coverage: 'coverage/{,*/}*'
    },

    concat: {
      dist: {
        files: {
          // yng-utils has to be at top of concatenated file
          '<%= factoryng.dist %>/factoryng.js':
            ['<%= factoryng.scripts %>/yng-utils.js',
             '<%= factoryng.scripts %>/yng.js',
             '<%= factoryng.scripts %>/event-shim.js',
             'node_modules/events/events.js'],

          '<%= factoryng.dist %>/adapters/pouchyng.js':
            ['<%= factoryng.scripts %>/adapters/pouchyng-common.js',
             '<%= factoryng.scripts %>/adapters/pouchyng.js'],

          '<%= factoryng.dist %>/adapters/delta-pouchyng.js':
            ['<%= factoryng.scripts %>/adapters/pouchyng-common.js',
             '<%= factoryng.scripts %>/adapters/delta-pouchyng.js']
        }
      }
    },

    uglify: {
      dist: {
        files: [{
          expand: true,
          src: '**/*.js',
          dest: '<%= factoryng.dist %>',
          cwd: '<%= factoryng.dist %>',
          rename: function(dest, src) { return dest + '/' + src.replace('.js', '.min.js'); }
        }]
      }
    },

    copy: {
      dist: {
        files: [{
          expand: true,
          flatten: true,
          cwd: '<%= factoryng.scripts %>',
          dest: '<%= factoryng.dist %>/adapters',
          src: [
            'adapters/*',
            '!adapters/templatyng.js',
            '!event-shim.js',
            '!adapters/pouchyng-common.js',
            '!adapters/pouchyng.js',
            '!adapters/delta-pouchyng.js'
          ]
        }]
      }
    },

    // Test settings
    karma: {
      unit: {
        configFile: 'test/karma.conf.js',
        singleRun: true
      }
    },

    'code-coverage-enforcer': {
      options: {
        lcovfile: 'coverage/phantomjs/lcov.info',
        lines: 100,
        functions: 100,
        branches: 100,
        src: 'scripts',
        excludes: ['scripts/adapters/templatyng.js']
      }
    }
  });

  grunt.registerTask('serve', 'Compile then start a connect web server', function (target) {
    if (target === 'dist') {
      return grunt.task.run(['build', 'connect:dist:keepalive']);
    }

    grunt.task.run([
      'clean:server',
      'connect:livereload',
      'watch'
    ]);
  });

  grunt.registerTask('server', 'DEPRECATED TASK. Use the "serve" task instead', function (target) {
    grunt.log.warn('The `server` task has been deprecated. Use `grunt serve` to start a server.');
    grunt.task.run(['serve:' + target]);
  });

  grunt.registerTask('test', [
    'clean:server',
    'clean:coverage',
    'connect:test',
    'karma',
    'code-coverage-enforcer'
  ]);

  grunt.registerTask('build', [
    'clean:dist',
    'concat',
    'copy',
    'uglify'
  ]);

  grunt.registerTask('default', [
    'newer:jshint',
    'test',
    'build'
  ]);
};
