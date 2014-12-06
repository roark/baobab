/**
 * Baobab Data Structure
 * ======================
 *
 * Encloses an immutable set of data exposing useful cursors to its user.
 */
var Cursor = require('./cursor.js'),
    EventEmitter = require('emmett'),
    Typology = require('typology'),
    clone = require('lodash.clonedeep'),
    helpers = require('./helpers.js'),
    update = require('./update.js'),
    merge = require('./merge.js'),
    types = require('./typology.js'),
    mixins = require('./mixins.js'),
    defaults = require('../defaults.json');

/**
 * Main Class
 */
function Baobab(initialData, opts) {

  // New keyword optional
  if (!(this instanceof Baobab))
    return new Baobab(initialData, opts);

  if (!types.check(initialData, 'object'))
    throw Error('Baobab: invalid data.');

  // Extending
  EventEmitter.call(this);

  // Properties
  this.data = clone(initialData);

  // Privates
  this._futureUpdate = {};
  this._willUpdate = false;
  this._history = [];

  // Merging defaults
  this.options = merge(opts, defaults);

  // Internal typology
  this.typology = this.options.typology ?
    (types.check(this.options.typology, 'typology') ?
      this.options.typology :
      new Typology(this.options.typology)) :
    new Typology();

  // Internal validation
  this.validate = this.options.validate || null;

  if (!this.check())
    throw Error('Baobab: invalid data');

  // Mixin
  this.mixin = mixins.baobab(this);
}

helpers.inherits(Baobab, EventEmitter);

/**
 * Private prototype
 */
Baobab.prototype._stack = function(spec) {

  if (!types.check(spec, 'object'))
    throw Error('Baobab.update: wrong specification.');

  this._futureUpdate = merge(spec, this._futureUpdate);

  // Should we let the user commit?
  if (!this.options.autoCommit)
    return this;

  // Should we update synchronously?
  if (!this.options.delay)
    return this.commit();

  // Updating asynchronously
  if (!this._willUpdate) {
    this._willUpdate = true;
    helpers.later(this.commit.bind(this));
  }

  return this;
};

Baobab.prototype._archive = function() {
  if (this.options.maxHistory <= 0)
    return;

  var record = {
    data: clone(this.data)
  };

  // Replacing
  if (this._history.length === this.options.maxHistory) {
    this._history.pop();
  }
  this._history.unshift(record);

  return record;
};

/**
 * Prototype
 */
Baobab.prototype.check = function() {
  return this.validate ?
    this.typology.check(this.data, this.validate) :
    true;
};

Baobab.prototype.commit = function(data, log) {
  var self = this;

  if (data) {

    // Override
    this.data = data;
  }
  else {

    // Applying modification (mutation)
    var record = this._archive();
    var log = update(this.data, this._futureUpdate);

    if (record)
      record.log = log;
  }

  if (!this.check())
    this.emit('invalid');

  // Baobab-level update event
  this.emit('update', {
    log: log
  });

  // Resetting
  this._futureUpdate = {};
  this._willUpdate = false;

  return this;
};

Baobab.prototype.select = function(path) {
  if (!path)
    throw Error('Baobab.select: invalid path.');

  if (arguments.length > 1)
    path = Array.prototype.slice.call(arguments);

  if (!types.check(path, 'path'))
    throw Error('Baobab.select: invalid path.');
  return new Cursor(this, path);
};

Baobab.prototype.get = function(path) {
  var data;

  if (arguments.length > 1)
    path = Array.prototype.slice.call(arguments);

  if (path)
    data = helpers.getIn(this.data, typeof path === 'string' ? [path] : path);
  else
    data = this.data;

  return this.options.clone ? clone(data) : data;
};

Baobab.prototype.getReference = function(path) {
  var data;

  if (arguments.length > 1)
    path = Array.prototype.slice.call(arguments);

  if (path)
    data = helpers.getIn(this.data, typeof path === 'string' ? [path] : path);
  else
    data = this.data;

  return data;
};

Baobab.prototype.set = function(key, val) {

  if (arguments.length < 2)
    throw Error('Baobab.set: expects a key and a value.');

  var spec = {};
  spec[key] = {$set: val};

  return this.update(spec);
};

Baobab.prototype.update = function(spec) {
  return this._stack(spec);
};

Baobab.prototype.hasHistory = function() {
  return !!this._history.length;
};

Baobab.prototype.getHistory = function() {
  return this._history;
};

Baobab.prototype.undo = function() {
  if (!this.hasHistory())
    throw Error('Baobab.undo: no history recorded, cannot undo.');

  var lastRecord = this._history.shift();
  this.commit(lastRecord.data, lastRecord.log);
};

/**
 * Type definition
 */
types.add('baobab', function(v) {
  return v instanceof Baobab;
});

/**
 * Output
 */
Baobab.prototype.toJSON = function() {
  return this.get();
};

/**
 * Export
 */
module.exports = Baobab;