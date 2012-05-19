/*!
 * Coolony's Kiwi
 * Copyright ©2012 Pierre Matri <pierre.matri@coolony.com>
 * MIT Licensed
 */

/**
 * Module dependencies
 */

var fs = require('fs');
var path = require('path');
var frame = require('frame');


/**
 * Constants
 */

var DEFAULT_FILE_EXTENSION = '.kiwi';


/**
 * Load `filePath`, and invoke `callback(err, data)`.
 *
 * @param {String} filePath
 * @param {Function} callback
 * @api private
 */

module.exports.loadTemplate = function(filePath, callback) {
  fs.readFile(filePath, 'utf-8', function onLoad(err, data) {
    if(err) return callback(err);
    callback(null, data);
  })
}


/**
 * Lookup `template` relative to `parentTemplate`, and invoke
 * `callback(err, filePath)`.
 *
 * @param {String} template
 * @param {Template} parentTemplate
 * @param (Function} callback
 * @api private
 */

module.exports.lookupTemplate = function(name, parentTemplate, callback) {
  var ext = path.extname(name);
  //if(!ext.length) name = name + DEFAULT_FILE_EXTENSION;
  if(name.substr(0, 1) !== '/') {
    if(!parentTemplate.options.path) {
      return callback(new Error(  'RenderError: Can\'t locate template '
                                + '`' + name + '`. '
                                + 'Relative path without original path given.'
                                ));
    }
    name = path.join(path.dirname(parentTemplate.options.path), name);
  }

  function tryWithoutExtension() {
    path.exists(name, function(exists) {
      if(!exists) return tryWithExtension();
      callback(null, name);
    });
  }

  function tryWithExtension() {
    var ext = path.extname(name);
    if(ext.length && ext === DEFAULT_FILE_EXTENSION) {
      callback(new Error(  'RenderError: Can\'t locate template '
                         + '`' + name + '`.'
                         ));
    }
    name = name + DEFAULT_FILE_EXTENSION;
    path.exists(name, function(exists) {
      if(!exists) {
        return callback(new Error(  'RenderError: Can\'t locate template '
                                  + '`' + name + '`.'
                                  ));
      }
      callback(null, name);
    })
  }

  tryWithoutExtension();
}


/**
 * Asynchronously apply `processor` to `input`, and invoke
 * `callback(err, result)`.
 *
 * @param {Mixed} input
 * @param {Function} processor
 * @param {Function} callback
 * @api private
 */

var apply = module.exports.apply = function(input, processor, args, callback) {

  if(typeof args === 'function' && !callback) {
    callback = args;
    args = null;
  }

  function done(err, result) {
    if(err) return callback(err);
    callback(null, result);
  }

  processor.apply(this, [input].concat(args || []).concat([done]));
}


/**
 * Asynchronously apply `processors` to `input` with `args`, and invoke
 * `callback(err, result)`.
 *
 * @param {Mixed} input
 * @param {Function[]} processors
 * @param {Mixed[]} [args]
 * @param {Function} callback
 * @api private
 */

module.exports.applyAll = function(input, processors, args, callback) {

  function applyOne(processor, next) {
    apply(input, processor, args || [], function onApplied(err, result) {
      if(err) return next(err);
      input = result;
      next();
    });
  }

  function done(err) {
    if(err) return callback(err);
    callback(null, input);
  }

  if(typeof args === 'function' && !callback) {
    callback = args;
    args = null;
  }
  frame.asyncForEach(processors, applyOne, done);
}

/**
 * Asynchronously compiles `tokens`, and invoke
 * `callback(err, compiled)` with `compiled` as an array.
 *
 * @param {BaseToken[]} tokens
 * @param {Function} callback
 * @api private
 */

function compileTokenArray(tokens, compiler, callback) {
  var acc = [];
  var index = 0;

  function compileOne(token, next) {
    token.compile(compiler, function onCompiled(err, compiled) {
      if(err) return next(err);
      acc.push(compiled);
      next(null, compiled);
    });
    index++;
  }

  function done(err) {
    if(err) return callback(err);
    callback(null, acc);
  }

  frame.asyncForEach(tokens, compileOne, done);
}
module.exports.compileTokenArray = compileTokenArray;


/**
 * Asynchronously compiles `tokens`, glue them, and invoke
 * `callback(err, compiled)`.
 *
 * @param {BaseToken[]} tokens
 * @param {Function} callback
 * @api private
 */

module.exports.compileTokens = function(tokens, compiler, callback) {
  compileTokenArray(tokens, compiler, function(err, compiled) {
    if(err) return callback(err);
    callback(null, compiled.join(''));
  })
}


/**
 * Escape `str` for use in template compilation.
 *
 * @param {String} str
 * @return {String} Escaped `str`.
 * @api private
 */

module.exports.escapeCompiledString = function(str) {
  return str.replace(/([\\"])/g, '\\$1')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
}