module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    concat: {
      options: {
        separator: ''
      },
      smalleditor_core: {
        src: ['src/js/smalleditor-core.js'],
        dest: 'dist/js/smalleditor-core.js'
      },
      smalleditor_directive: {
        src: ['src/js/smalleditor-directive.js', '<%= ngtemplates.se_toolbar.dest %>'],
        dest: 'dist/js/smalleditor-directive.js'
      },
      smalleditor: {
        src: ['src/js/smalleditor-core.js', 'src/js/smalleditor-directive.js', '<%= ngtemplates.se_toolbar.dest %>'],
        dest: 'dist/js/<%= pkg.name %>.js'
      }
    },
    uglify: {
      dist: {
        options: {
          banner: '/*! <%= pkg.name %>-<%= pkg.version %> <%= grunt.template.today("dd-mm-yyyy") %> */\n',
          compress: true
        },
        files: {
          'dist/js/smalleditor-core.min.js': ['<%= concat.smalleditor_core.dest %>'],
          'dist/js/smalleditor-directive.min.js': ['<%= concat.smalleditor_directive.dest %>'],
          'dist/js/smalleditor.min.js': ['<%= concat.smalleditor.dest %>']
        }
      }
    },
    qunit: {
      files: ['test/**/*.html']
    },
    jshint: {
      files: ['Gruntfile.js', 'src/**/*.js', 'test/**/*.js'],
      options: {
        // options here to override JSHint defaults
        globals: {
          jQuery: true,
          console: true,
          module: true,
          document: true
        }
      }
    },
    less: {
      production: {
        files: {
          "dist/css/<%= pkg.name %>.css": "src/less/<%= pkg.name %>.less"
        }
      }
    },
    ngtemplates: {
      se_toolbar: {
        options: {
          module: '<%= pkg.name %>'
        },
        cwd: './',
        src: 'views/_se_toolbar.html',
        dest: '.tmp/scripts/_se_toolbar.js'
      }
    },
    watch: {
      less: {
        files: ['src/less/**/*.less'],
        tasks: ['less']
      },
      jshint: {
        files: ['<%= jshint.files %>'],
        tasks: ['jshint']
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-qunit');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-usemin');
  grunt.loadNpmTasks('grunt-angular-templates');

  grunt.registerTask('test', ['jshint', 'qunit']);
  grunt.registerTask('default', ['jshint', 'ngtemplates', 'less', 'concat', 'uglify']);
};
