/**
 * @license me-dialog 1.0.8 Copyright (c) Mandana Eibegger <scripts@schoener.at>
 * Available via the MIT license.
 * see: https://github.com/meibegger/me-dialog for details
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.meDialog = factory();
  }
}(this, function () {


/**
 * @license almond 0.3.2 Copyright jQuery Foundation and other contributors.
 * Released under MIT license, http://github.com/requirejs/almond/LICENSE
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice,
        jsSuffixRegExp = /\.js$/;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap, lastIndex,
            foundI, foundStarMap, starI, i, j, part, normalizedBaseParts,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name) {
            name = name.split('/');
            lastIndex = name.length - 1;

            // If wanting node ID compatibility, strip .js from end
            // of IDs. Have to do this here, and not in nameToUrl
            // because node allows either .js or non .js to map
            // to same file.
            if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
            }

            // Starts with a '.' so need the baseName
            if (name[0].charAt(0) === '.' && baseParts) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that 'directory' and not name of the baseName's
                //module. For instance, baseName of 'one/two/three', maps to
                //'one/two/three.js', but we want the directory, 'one/two' for
                //this normalization.
                normalizedBaseParts = baseParts.slice(0, baseParts.length - 1);
                name = normalizedBaseParts.concat(name);
            }

            //start trimDots
            for (i = 0; i < name.length; i++) {
                part = name[i];
                if (part === '.') {
                    name.splice(i, 1);
                    i -= 1;
                } else if (part === '..') {
                    // If at the start, or previous value is still ..,
                    // keep them so that when converted to a path it may
                    // still work when converted to a path, even though
                    // as an ID it is less than ideal. In larger point
                    // releases, may be better to just kick out an error.
                    if (i === 0 || (i === 1 && name[2] === '..') || name[i - 1] === '..') {
                        continue;
                    } else if (i > 0) {
                        name.splice(i - 1, 2);
                        i -= 2;
                    }
                }
            }
            //end trimDots

            name = name.join('/');
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            var args = aps.call(arguments, 0);

            //If first arg is not require('string'), and there is only
            //one arg, it is the array form without a callback. Insert
            //a null so that the following concat is correct.
            if (typeof args[0] !== 'string' && args.length === 1) {
                args.push(null);
            }
            return req.apply(undef, args.concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            callbackType = typeof callback,
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (callbackType === 'undefined' || callbackType === 'function') {
            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback ? callback.apply(defined[name], args) : undefined;

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (config.deps) {
                req(config.deps, config.callback);
            }
            if (!callback) {
                return;
            }

            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        return req(cfg);
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {
        if (typeof name !== 'string') {
            throw new Error('See almond README: incorrect module build, no module name');
        }

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("almond", function(){});

define('variable',[],function () {

  /*
   ---------------
   functions
   ---------------
   */

  /**
   * Create a copy of a variable.
   *
   * copyValues(vals [, deep])
   *
   * @param vals mixed
   * @param deep bool; optional; deep-copy; default is true
   * @returns {*} mixed; a copy of the passed value
   */
  function copyValues(vals, deep) {
    deep = (typeof(deep) === 'undefined') || deep;

    var copy,
      val;
    if (Array.isArray(vals)) {
      copy = [];
      for (var i in vals) {
        val = vals[i];
        copy.push((deep && typeof val === 'object') ?
          copyValues(val)
          : val);
      }

    } else if (vals && typeof(vals) === 'object' && typeof(vals.tagName) === 'undefined') {
      copy = {};
      for (var key in vals) {
        val = vals[key];
        copy[key] = (deep && typeof val === 'object') ?
          copyValues(val)
          : val;
      }

    } else {
      copy = vals;
    }
    return copy;
  }

  /**
   * Merge 2 Objects and return a copy.
   *
   * mergeObjects(object1, object2)
   *
   * @param object1 Object
   * @param object2 Object
   * @returns {{}} New merged Object
   */
  function mergeObjects(object1, object2) {
    object1 = object1 || {};
    object2 = object2 || {};
    var result = {};
    for (var key1 in object1) {
      var option1 = object1[key1];
      if (object2.hasOwnProperty(key1)) {
        var option2 = object2[key1];
        if (Array.isArray(option2) || typeof(option2) !== 'object' || typeof(option1) !== 'object') {
          result[key1] = copyValues(option2);
        } else {
          result[key1] = mergeObjects(option1, option2);
        }
      } else {
        result[key1] = copyValues(option1);
      }
    }
    for (var key2 in object2) {
      if (!result.hasOwnProperty(key2)) {
        result[key2] = copyValues(object2[key2]);
      }
    }
    return result;
  }

  /**
   * Check if an object is empty.
   *
   * isEmptyObject(object)
   *
   * @param object Object
   * @returns {boolean}
   */
  function isEmptyObject(object) {
    for (var i in object) {
      return false;
    }
    return true;
  }

  /*
   ---------------
   api
   ---------------
   */

  return {
    copyValues: copyValues,
    mergeObjects: mergeObjects,
    isEmptyObject: isEmptyObject
  };

});

define('element',[],function () {

  /*
   ---------------
   functions
   ---------------
   */

  /**
   * Get the specified element.
   *
   * getElementById(elementSpec)
   *
   * @param elementSpec mixed; string (id) or element;
   * @returns {*} element or null
   */
  function getElementById(elementSpec) {
    if (typeof(elementSpec) === 'object' && typeof(elementSpec.tagName) !== 'undefined') {
      return elementSpec;

    } else if (typeof(elementSpec) === 'string') {
      return document.getElementById(elementSpec);

    } else {
      return null;
    }
  }

  /**
   * Get the ID of an element. If the element has no ID, it will be assigned a random ID.
   *
   * getId(element [, prefix])
   *
   * @param element DOM element
   * @param prefix string; optional; A prefix for generated IDs; default is 'id-'
   * @returns {string} ID
   */
  function getId(element, prefix) {
    var id = element.getAttribute('id');

    if (!id) { // assign an ID
      prefix = prefix || 'id-';
      do {
        var date = new Date();
        id = prefix + Math.ceil(date.valueOf() % 10000 * Math.random());
      } while (document.getElementById(id));

      element.setAttribute('id', id);
    }

    return id;
  }

  /**
   * Get all ancestors of an element, possibly matching a selector, up to an optional container.
   *
   * Note: this function uses matches(selector), so you need to include a polyfill for all IEs!
   *
   * getAncestors(element [, selector] [, container] [, single])
   *
   * @param element DOM-Element;
   * @param selector String; optional; selector to match the parents against
   * @param container DOM-Element; optional; max parent to check; default is body
   * @param single Boolean; optional; return only the next matching ancestor
   * @return mixed; array or false/element if single===true
   */
  function getAncestors(element, selector, container, single) {
    // prepare arguments
    var
      argSelector = false,
      argContainer = false,
      argSingle = false;
    for (var i = 1; i < arguments.length; i++) {
      switch (typeof(arguments[i])) {
        case 'string':
          argSelector = arguments[i];
          break;
        case 'object':
          argContainer = arguments[i];
          break;
        case 'boolean':
          argSingle = arguments[i];
          break;
      }
    }
    selector = argSelector;
    container = argContainer || document.body;
    single = argSingle;

    var parents = [],
      getAncestors = function (element) {
        var parent = element.parentElement;
        if (!selector || parent.matches(selector)) {
          if (single) {
            return parent;
          } else {
            parents.push(parent);
          }
        }
        if (parent === container) {
          return single ? false : parents;
        }
        return getAncestors(parent);
      }
      ;
    return getAncestors(element);
  }

  /**
   * Check if an element is the parent of another element.
   *
   * isParent(parent, child)
   *
   * @param parent DOM-element
   * @param child DOM-element
   * @returns {boolean}
   */
  function isParent(parent, child) {
    var node = child.parentNode;
    while (node !== null) {
      if (node === parent) {
        return true;
      }
      node = node.parentNode;
    }
    return false;
  }

  /**
   * Add 1 or more values to an attribute.
   *
   * addAttributeValues(element, attributeName, values)
   *
   * @param element DOM-element
   * @param attributeName string
   * @param values mixed; string or array of strings
   */
  function addAttributeValues(element, attributeName, values) {
    values = Array.isArray(values) ? values : [values];

    var
      attributeVal = element.getAttribute(attributeName),
      currentVals = attributeVal ? attributeVal.split(' ') : [];

    for (var i = 0; i < values.length; i++) {
      var value = values[i];
      if (currentVals.indexOf(value) === -1) {
        currentVals.push(value);
      }
    }
    element.setAttribute(attributeName, currentVals.join(' '));
  }

  /**
   * Remove one or more values from an attribute.
   *
   * removeAttributeValues(element, attributeName, values)
   *
   * @param element DOM-element
   * @param attributeName string
   * @param values mixed; string or array of strings
   */
  function removeAttributeValues(element, attributeName, values) {
    var attributeVal = element.getAttribute(attributeName);
    if (attributeVal) {
      var
        expStart = '((^| )',
        expEnd = '(?= |$))';

      attributeVal = attributeVal.replace(new RegExp(Array.isArray(values) ?
        expStart + values.join(expEnd + '|' + expStart) + expEnd :
        expStart + values + expEnd, 'g'),
        '');

      if (attributeVal) {
        element.setAttribute(attributeName, attributeVal);
      } else {
        element.removeAttribute(attributeName);
      }
    }
  }

  /*
   ---------------
   api
   ---------------
   */

  return {
    getElementById: getElementById,
    getId: getId,
    getAncestors: getAncestors,
    isParent: isParent,
    addAttributeValues: addAttributeValues,
    removeAttributeValues: removeAttributeValues
  };
});

define('event',['./variable'],function (variable) {

  /*
   ---------------
   functions
   ---------------
   */

  /**
   * Add an event-listener and register it to an instance.
   * The instance will get a property 'registeredEvents' storing the registered events.
   *
   * registerEvent(scope, target, type, fn [, capture])
   *
   * @param scope object; instance to register the event to
   * @param target DOM object; event target
   * @param type string; event name
   * @param fn function; event handler
   * @param capture boolean; optional; capture the event; default is false
   */
  function registerEvent(scope, target, type, fn, capture) {

    capture = capture || false;

    var
      registeredEvents = scope.registeredEvents = scope.registeredEvents || {},
      typeListeners = registeredEvents[type] = registeredEvents[type] || [],
      targetTypeHandlers = false
      ;

    for (var i in typeListeners) {
      var typeHandlers = typeListeners[i];
      if (typeHandlers.tg === target) {
        targetTypeHandlers = typeHandlers;
        break;
      }
    }

    if (!targetTypeHandlers) {
      targetTypeHandlers = {
        tg: target,
        fns: []
      };
      typeListeners.push(targetTypeHandlers);
    }

    targetTypeHandlers.fns.push([fn, capture]);

    target.addEventListener(type, fn, capture);

  }

  /**
   * Remove (an) event-listener(s), previously registered to an instance.
   *
   * unregisterEvent(scope [, target] [, type] [, fn] [, capture])
   *
   * @param scope object; instance the event was registered to
   * @param target DOM object; optional; event target; if not set, matching events will be removed on all targets
   * @param type string; optional; event name; if not set, all event-types will be removed
   * @param fn function; optional; event handler; if not set, all event-handlers will be removed
   * @param capture boolean; optional; if not set, captured & not-captured events are removed, if true only captured events are removed, if false only not-captured events are removed
   */
  function unregisterEvent(scope, target, type, fn, capture) {
    if (!scope.registeredEvents) {
      return;
    }
    var registeredEvents = scope.registeredEvents;

    if (!type) {
      for (type in registeredEvents) {
        unregisterEvent(scope, target, type, fn, capture);
      }
      return;
    }

    if (!registeredEvents.hasOwnProperty(type)) {
      return;
    }
    var typeListeners = registeredEvents[type];

    if (!target) {
      var cTypeListeners = variable.copyValues(typeListeners);
      while (cTypeListeners.length) {
        var typeListener = cTypeListeners.shift();
        unregisterEvent(scope, typeListener.tg, type, fn, capture);
      }
      return;
    }

    var fns = false,
      typeHandlers;
    for (var j in typeListeners) {
      typeHandlers = typeListeners[j];
      if (typeHandlers.tg === target) {
        fns = typeHandlers.fns;
        break;
      }
    }
    if (!fns) {
      return;
    }

    for (var k = 0; k < fns.length; k++) {
      var fnDef = fns[k];
      if ((typeof(fn) === 'undefined' || !fn || fn === fnDef[0]) &&
        (typeof(capture) === 'undefined' || capture === fnDef[1])) {
        fns.splice(k, 1);
        target.removeEventListener(type, fnDef[0], fnDef[1]);
        k--;
      }
    }

    // remove unused info
    if (!fns.length) {
      typeListeners.splice(j, 1);
    }
    if (!typeListeners.length) {
      delete registeredEvents[type];
    }

  }

  /**
   * Rate-limit the execution of a function (e.g. for events like resize and scroll).
   * Returns a new function, that when called repetitively, executes the original function no more than once every delay milliseconds.
   * (based on https://remysharp.com/2010/07/21/throttling-function-calls)
   *
   * throttle(fn [, threshhold] [, trailing] [, scope])
   *
   * @param fn function; original function to call
   * @param threshhold int; optional; delay (ms) - execute fn no more than once every delay milliseconds; default is 250
   * @param trailing boolean; optional; execute fn after the calls stopped; default is true
   * @param scope object; optional; instance the function should be applied to
   * @returns {Function}
   */
  function throttle(fn, threshhold, trailing, scope) {
    // prepare arguments
    threshhold = threshhold || 250;
    trailing = typeof(trailing) === 'undefined' ? true:trailing;
    scope = scope || this;

    var
      last,
      deferTimer = null;

    return function () {
      var
        now = +new Date(),
        args = arguments;

      if (last && now < last + threshhold) {
        if (trailing) {
          // hold on to it
          clearTimeout(deferTimer);
          deferTimer = setTimeout(function () {
            last = now;
            fn.apply(scope, args);
          }, threshhold);
        }

      } else {
        last = now;
        clearTimeout(deferTimer);
        fn.apply(scope, args);
      }
    };
  }

  /**
   * Coalesce multiple sequential calls into a single execution at either the beginning or end (e.g. for events like keydown).
   * Returns a new function, that when called repetitively, executes the original function just once per “bunch” of calls.
   *
   * debounce(fn [, pause] [, beginning] [, scope])
   *
   * @param fn function; original function to call
   * @param pause int; optional; min pause (ms) between bunches of calls; default is 250
   * @param beginning boolean; execute at the beginning of the call-bunch; default is false
   * @param scope object; optional; instance the function should be applied to
   * @returns {Function}
   */
  function debounce(fn, pause, beginning, scope) {
    // prepare arguments
    pause = pause || 250;
    scope = scope || this;

    var
      last,
      pauseTimer = null;

    return function () {
      var
        now = +new Date(),
        args = arguments;

      if (!beginning) {
        // defer a possible function call
        clearTimeout(pauseTimer);
        pauseTimer = setTimeout(function () {
          fn.apply(scope, args);
        }, pause);

      } else if (!last || now > last + pause) {
        fn.apply(scope, args);
      }

      last = now;
    };
  }

  /*
   ---------------
   api
   ---------------
   */

  return {
    registerEvent: registerEvent,
    unregisterEvent: unregisterEvent,
    throttle: throttle,
    debounce: debounce
  };
});


define('meTools',['variable','element','event'], function (copy,element,event) {

  'use strict';

  var api = {};
  for (var i in arguments) {
    for (var j in arguments[i]) {
      api[j] = arguments[i][j];
    }
  }

  return api;

});
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define('meLockView',[], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.meLockView = factory();
  }
}(this, function () {
  'use strict';

  /**
   * me-lock-view - A utility script to "lock" the main content of the page to prevent scrolling of the content in the
   * background if you, for instance, open a modal dialog on top of the page
   *
   * @link https://github.com/meibegger/me-lock-view
   * @license MIT
   */

  var

  /*
   ---------------
   settings
   ---------------
   */

  // name of the attribute set on an element to mark it as the view-wrapper
    viewAttribute = 'data-me-view',

  // value set to the view-attribute if the view is locked
    lockValue = 'locked',

  // value set to the view-attribute if the view isn't locked
    unlockValue = '',

  /*
   ---------------
   variables
   ---------------
   */

  // remember how many "open" locks exist
    openLocks = 0,

  // cache the body element
    body,

  // cache the documentElement
    documentElement,

  // cache the view-wrapper
    viewWrapper,

  // before-lock subscriptions
    beforeLockSubscriptions = {},
    afterUnlockSubscriptions = {}
    ;

  /*
   ---------------
   functions
   ---------------
   */

  /**
   * Subscribe a function to be called before locking the screen
   * @param id String; id of the fn - used for unsubscribing
   * @param fn Function; fn(windowScrollLeft, windowScrollTop) called before locking the screen
   */
  function subscribeBeforeLock(id, fn) {
    beforeLockSubscriptions[id] = fn;
  }

  /**
   * Subscribe a function to be called after unlocking the screen
   * @param id String; id of the fn - used for unsubscribing
   * @param fn Function; fn(windowScrollLeft, windowScrollTop) called after unlocking the screen
   */
  function subscribeAfterUnlock(id, fn) {
    afterUnlockSubscriptions[id] = fn;
  }

  /**
   * Lock the view
   */
  function lock() {
    if (viewWrapper) {
      if (!openLocks) { // view is not locked yet

        // get the current scroll values
        var
          scrollLeft = body.scrollLeft || documentElement.scrollLeft,
          scrollTop = body.scrollTop || documentElement.scrollTop;

        // call the subscribed functions
        for (var id in beforeLockSubscriptions) {
          beforeLockSubscriptions[id](scrollLeft, scrollTop);
        }

        // mark the view-wrapper as locked
        viewWrapper.setAttribute(viewAttribute, lockValue);

        // scroll the view-wrapper (instead of the body)
        viewWrapper.scrollTop = scrollTop;
        viewWrapper.scrollLeft = scrollLeft;

        // scroll the body to the upper left
        window.scrollTo(0, 0);
      }

      // remember the lock request
      openLocks++;
    }
  }

  function unlock() {
    if (viewWrapper) {
      if (openLocks === 1) { // last unlock request

        // get the current scroll values
        var
          scrollLeft = viewWrapper.scrollLeft,
          scrollTop = viewWrapper.scrollTop;

        // mark the view-wrapper as unlocked
        viewWrapper.setAttribute(viewAttribute, unlockValue);

        // reset the scroll ot the view-wrapper
        viewWrapper.scrollTop = 0;
        viewWrapper.scrollLeft = 0;

        // scroll the body to the initial scroll position
        window.scrollTo(scrollLeft, scrollTop);

        // call the subscribed functions
        for (var id in afterUnlockSubscriptions) {
          afterUnlockSubscriptions[id](scrollLeft, scrollTop);
        }
      }

      // remember the unlock request
      if (openLocks) {
        openLocks--;
      }
    }
  }

  function isLocked() {
    return !!openLocks;
  }

  /*
   ---------------
   initialization
   ---------------
   */

  function init() {
    // get the elements holding the document scroll
    body = document.body;
    documentElement = document.documentElement;

    // get the view wrapper
    viewWrapper = document.querySelector('[' + viewAttribute + ']');
    if (!viewWrapper) {
      console.error('meLockView: view-wrapper not found');
    }
  }

  // initialize the utility as soon as the document has finished loading. We can now access the DOM elements.
  if (document.readyState !== 'loading') {
    init();
  } else {
    window.addEventListener('DOMContentLoaded', function loaded() {
      window.removeEventListener('DOMContentLoaded', loaded);
      init();
    });
  }

  /*
   ---------------
   api
   ---------------
   */

  return {
    lock: lock,
    unlock: unlock,
    isLocked: isLocked,
    subscribeBeforeLock: subscribeBeforeLock,
    subscribeAfterUnlock: subscribeAfterUnlock
  };

}));

/**
 * Uses classList - possibly use a polyfill for older browsers (http://caniuse.com/#feat=classlist)
 * Uses animationFrame - possibly use a polyfill for older browsers (http://caniuse.com/#feat=requestanimationframe)
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define('meShowTransition',['meTools'], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory(meTools);
  } else {
    root.meShowTransition = factory(meTools);
  }
}(this, function (meTools) {

  var

  /*
   ---------------
   settings
   ---------------
   */

    defaultOptions = {
      callbacks: { // false or fn(params); params = {container: CONTAINER,immediate:BOOL (immediate show/hide call - no transition)}
        beforeShow: false,
        beforeShowTransition: false,
        afterShowTransition: false,
        afterShow: false,
        beforeHide: false,
        beforeHideTransition: false,
        afterHideTransition: false,
        afterHide: false
      },
      transitionEndElement: false, // element to listen to the transitionend event on (default is the container); use this if you use transitions on more than 1 element on show/hide to define the element which ends the transitions
      ignoreChildTransitions: false, // transitionEnd event bubbles - only listen to transitionEnd directly on the container (or transitionEndElement)
      transitionMaxTime: 500, // ms; timeout to end the show/hide transition states in case the transitionEnd event doesn't fire; set to 0 to not support transition
      indicators: { // classes added to mark states
        shown: 'me-shown', // set to the container as long as it is shown
        show: 'me-show', // set to the container during the show-transition
        hide: 'me-hide' // set to the container during the hide-transition
      }
    }
    ;

  /*
   ---------------
   meShowTransition
   ---------------
   */


  /**
   * Create a new instance
   *
   * meShowTransition(container [,show] [,options])
   *
   * @param container mixed; id or element; the container in which the focus should be maintained
   * @param show boolean; optional; show the container immediately (without transitions) onInit; default is false
   * @param options object; optional; overwrite the default options
   */
  function meShowTransition(container, show, options) {

    var that = this;

    // prepare arguments
    if (typeof(show) !== 'boolean') {
      options = show;
      show = false;
    }

    // init container
    var containerElement = container && meTools.getElementById(container);
    if (!containerElement) {
      throw new Error('meShowTransition: Container element not found');
    }

    // merge options
    initProperties.call(that).options = meTools.mergeObjects(defaultOptions, options);

    // prepare container
    that.container = containerElement;

    if (show) {
      this.show(true);
    } else {
      this.hide(true);
    }
  }


  /*
   ---------------
   private functions
   ---------------
   */

  function initProperties() {
    var that = this;

    that.options = {};
    that.container = null;
    that.showTransitionStartAnimation = null;
    that.showTransitionEndTimeout = null;
    that.hideTransitionStartAnimation = null;
    that.hideTransitionEndTimeout = null;
    that.showing = false;
    that.hiding = false;
    that.hidden = false;

    return that;
  }

  function markShown() {
    var that = this;
    that.container.classList.add(that.options.indicators.shown);
    that.container.setAttribute('aria-hidden', 'false');

    return that;
  }

  function markHidden() {
    var that = this;
    that.container.classList.remove(that.options.indicators.shown);
    that.container.setAttribute('aria-hidden', 'true');

    return that;
  }

  function showEnd(immediate) { // end of show
    immediate = immediate || false;
    var
      that = this,
      afterShowFn = that.options.callbacks.afterShow;

    if (afterShowFn) {
      afterShowFn({
        container: that.container,
        immediate: immediate
      });
    }

    that.showing = false;

    return that;
  }

  function hideEnd(immediate) { // end of hide
    immediate = immediate || false;
    var
      that = this,
      container = that.container,
      afterHideFn = that.options.callbacks.afterHide;

    // hide container
    container.style.display = 'none';
    that.hiding = false;
    that.hidden = true;

    // mark as hidden
    markHidden.call(that);


    if (afterHideFn) {
      afterHideFn({
        container: container,
        immediate: immediate
      });
    }

    return that;
  }

  function showTransitionEnd() {
    var
      that = this,
      options = that.options,
      container = that.container,
      afterTransitionFn = options.callbacks.afterShowTransition,
      transitionEndElement = that.options.transitionEndElement
      ;

    // clear listeners
    window.cancelAnimationFrame(that.showTransitionStartAnimation);
    clearTimeout(that.showTransitionEndTimeout);
    meTools.unregisterEvent(that, transitionEndElement, 'webkitTransitionEnd');
    meTools.unregisterEvent(that, transitionEndElement, 'transitionend');

    // after transition
    if (afterTransitionFn) {
      afterTransitionFn({
        container: container,
        immediate: false
      });
    }

    container.classList.remove(options.indicators.show);
    showEnd.call(that);

    return that;
  }

  function hideTransitionEnd() {
    var
      that = this,
      options = that.options,
      container = that.container,
      afterTransitionFn = options.callbacks.afterHideTransition,
      transitionEndElement = that.options.transitionEndElement
      ;

    // clear listeners
    window.cancelAnimationFrame(that.hideTransitionStartAnimation);
    clearTimeout(that.hideTransitionEndTimeout);
    meTools.unregisterEvent(that, transitionEndElement, 'webkitTransitionEnd');
    meTools.unregisterEvent(that, transitionEndElement, 'transitionend');

    // after transition
    if (afterTransitionFn) {
      afterTransitionFn({
        container: container,
        immediate: false
      });
    }

    container.classList.remove(options.indicators.hide);
    hideEnd.call(that);

    return that;
  }

  /*
   ---------------
   prototype
   ---------------
   */

  /**
   * Start showing the container
   * @param immediate bool; optional; show immediately
   * @returns {meShowTransition}
   */
  meShowTransition.prototype.show = function (immediate) {
    var
      that = this,
      options = that.options,
      container = that.container,
      transitionEndElement = options.transitionEndElement || container;

    function _showTransitionEnd(event) {
      if (!options.ignoreChildTransitions || !event || !event.target || event.target === transitionEndElement) {
        showTransitionEnd.call(that);
      }
    }

    if (immediate || that.canShow()) {
      var
        callbacks = options.callbacks,
        beforeShowFn = callbacks.beforeShow,
        beforeTransitionFn = callbacks.beforeShowTransition,

        indicators = options.indicators;

      // remember that we are showing
      that.showing = true;

      // end possible hide-transition
      if (that.hiding) {
        hideTransitionEnd.call(that);
      }

      that.hidden = false;

      // before show
      if (beforeShowFn) {
        beforeShowFn({
          container: container,
          immediate: immediate
        });
      }

      // show container
      container.style.display = 'block';

      if (!immediate && options.transitionMaxTime) { // transition

        // init transition-end-handling
        meTools.registerEvent(that, transitionEndElement, 'webkitTransitionEnd', _showTransitionEnd);
        meTools.registerEvent(that, transitionEndElement, 'transitionend', _showTransitionEnd);
        // set a transition-timeout in case the end-event doesn't fire
        that.showTransitionEndTimeout = setTimeout(_showTransitionEnd, options.transitionMaxTime);

        that.showTransitionStartAnimation = window.requestAnimationFrame(function () { // wait 2 ticks for the browser to apply the visibility
          that.showTransitionStartAnimation = window.requestAnimationFrame(function () {

            // before transition
            if (beforeTransitionFn) {
              beforeTransitionFn({
                container: container,
                immediate: false
              });
            }

            // mark as shown
            markShown.call(that);

            // start show transition and listeners
            container.classList.add(indicators.show);

          });
        });

      } else { // immediate show
        markShown.call(that);
        showEnd.call(that, immediate);
      }

    }

    return that;
  };

  /**
   * Start hiding the container
   * @param immediate bool; optional; hide immediately
   * @returns {meShowTransition}
   */
  meShowTransition.prototype.hide = function (immediate) {
    var
      that = this,
      options = that.options,
      container = that.container,
      transitionEndElement = options.transitionEndElement || container;

    function _hideTransitionEnd(event) {
      if (!options.ignoreChildTransitions || !event || !event.target || event.target === transitionEndElement) {
        hideTransitionEnd.call(that);
      }
    }

    if (immediate || !that.canShow()) {
      var
        callbacks = options.callbacks,
        beforeHideFn = callbacks.beforeHide,
        beforeTransitionFn = callbacks.beforeHideTransition,

        indicators = options.indicators;

      // remember that we are showing
      that.hiding = true;

      // end possible show-transition
      if (that.showing) {
        showTransitionEnd.call(that);
      }

      // before hide
      if (beforeHideFn) {
        beforeHideFn({
          container: container,
          immediate: immediate
        });
      }

      if (!immediate && options.transitionMaxTime) { // transition

        // init transition-end-handling
        meTools.registerEvent(that, transitionEndElement, 'webkitTransitionEnd', _hideTransitionEnd);
        meTools.registerEvent(that, transitionEndElement, 'transitionend', _hideTransitionEnd);
        // set a transition-timeout in case the end-event doesn't fire
        that.hideTransitionEndTimeout = setTimeout(_hideTransitionEnd, options.transitionMaxTime);

        that.hideTransitionStartAnimation = window.requestAnimationFrame(function () { // wait 2 ticks for the browser to apply beforeHideFn changes
          that.hideTransitionStartAnimation = window.requestAnimationFrame(function () {

            // before transition
            if (beforeTransitionFn) {
              beforeTransitionFn({
                container: container,
                immediate: false
              });
            }

            // start show transition and listeners
            container.classList.add(indicators.hide);

          });
        });

      } else { // immediate hide
        hideEnd.call(that);
      }
    }

    return that;
  };

  /**
   *
   * @returns {boolean} true if the component is in the process of hiding or hidden
   */
  meShowTransition.prototype.canShow = function () {
    return (this.hiding || this.hidden);
  };

  /**
   * Destroy the instance
   * @returns {null}
   */
  meShowTransition.prototype.destroy = function () {
    var that = this,
      container = that.container,
      indicators = that.options.indicators
      ;

    // clear listeners
    clearTimeout(that.showTransitionEndTimeout);
    clearTimeout(that.hideTransitionEndTimeout);
    meTools.unregisterEvent(that);

    // remove added classes
    for (var i in indicators) {
      container.classList.remove(indicators[i]);
    }

    // reset properties and remove all references
    initProperties.call(that);

    return null;
  };

  return meShowTransition;

}));
;(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define('meTrapFocus',['meTools'], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory(meTools);
  } else {
    root.meTrapFocus = factory(meTools);
  }
} (this, function(meTools) {

  /**
   * me-trap-focus - A small utility script to trap the focus within a container element
   *
   * @link https://github.com/meibegger/me-trap-focus
   * @license MIT
   */

  var
  /*
   ---------------
   constants
   ---------------
   */

    KEY_TAB = 9,

  /*
   ---------------
   settings
   ---------------
   */


    defaultOptions = {
      focusableSelector: 'a,frame,iframe,input:not([type=hidden]),select,textarea,button,*[tabindex]',  // selector for elements which are focusable
      taboutIndicator: '.me-tabout' // selector for an optional element placed before the 1st or after the last tabable element to prevent tabbing out of the page directly to the browser-window (e.g. placed after an iframe as last tabable element)
    }
    ;

  /*
   ---------------
   meTrapFocus
   ---------------
   */


  /**
   * Create a new instance
   * @param container mixed; id or element; the container in which the focus should be maintained
   * @param options object; optional; overwrite the default options
   */
  function meTrapFocus(container, options) {

    var that = this;

    // check arguments
    var containerElement = container && meTools.getElementById(container);
    if (!containerElement) {
      throw new Error('meTrapFocus: Container element not found');
    }

    // merge options
    initProperties.call(that).options = meTools.mergeObjects(defaultOptions, options);

    // prepare container
    that.container = containerElement;
    if (!containerElement.getAttribute('tabindex')) { // add tabindex to the container, so that it can get focus onClick and receives tab-events as target (to prevent tabbing out)
      containerElement.setAttribute('tabindex', '-1');
    }
    meTools.registerEvent(that, containerElement, 'keydown', function (event) {
      handleKeyboard.call(that, event);
    });

    fetchFocusables.call(that);

  }


  /*
   ---------------
   private functions
   ---------------
   */

  function initProperties() {
    var that = this;

    that.options = {};

    that.container = null;
    that.focusables = []; // all possibly focusable elements ordered by tabindex

    return that;
  }

  function handleKeyboard(event) {
    if (!event.ctrlKey && !event.altKey) {
      var code = (event.keyCode ? event.keyCode : event.which);

      if (code == KEY_TAB) {  // tab-loop
        var that = this,
          taboutIndicator = that.options.taboutIndicator,
          focusables = that.focusables,
          tabables;

        if (event.shiftKey) {   // back-tab
          tabables = getFilteredFocusables.call(that,-1);

          if (tabables[tabables[0].matches(taboutIndicator) ? 1 : 0] === event.target ||    // back-tab on first element -> focus last element
            focusables.indexOf(event.target) < focusables.indexOf(tabables[0]) ||
            event.target===that.container) {

            focusLast.call(that,tabables);

            event.preventDefault();
            event.stopPropagation();
          }

        } else {    // tab
          tabables = getFilteredFocusables.call(that,1);

          if (tabables[tabables.length - (tabables[tabables.length - 1].matches(taboutIndicator) ? 2 : 1)] === event.target ||    // tab on last element -> focus first element
            focusables.indexOf(event.target) > focusables.indexOf(tabables[tabables.length-1])) {

            focusFirst.call(that,tabables);

            event.preventDefault();
            event.stopPropagation();
          }
        }
      }
    }
  }

  /**
   * Get all radio-buttons belonging to a radio-button's group
   * @param radioButton
   * @returns []
   */
  function getRadioGroup(radioButton) {
    // get the form for the radiobutton
    var
      form = meTools.getAncestors(radioButton, 'form', true) || // radiobutton is contained in a form
        document,
      name = radioButton.getAttribute('name');

    return [].slice.call(form.querySelectorAll('input[type="radio"][name="' + name + '"]'));
  }

  function fetchFocusables () {
    var
      that = this,
      options = that.options,
      _taboutFocus = function (event) {
        taboutFocus.call(that, event);
      };

    that.focusables = orderFocusables(that.container.querySelectorAll(options.focusableSelector));

    for (var i = 0; i < that.focusables.length; i++) {
      var element = that.focusables[i];

      if (element.matches(options.taboutIndicator)) {
        meTools.unregisterEvent(that, element, 'focus'); // unregister old event
        meTools.registerEvent(that, element, 'focus', _taboutFocus);
      }
    }

    return that;
  }

  function orderFocusables (focusables) {
    var
      byTabindex = [],
      ordered = [];

    for (var i = 0; i < focusables.length; i++) {
      var
        focusable = focusables[i],
        tabindex = Math.max(0, focusable.getAttribute('tabindex') || 0);

      byTabindex[tabindex] = byTabindex[tabindex] || [];
      byTabindex[tabindex].push(focusable);
    }

    for (var j in byTabindex) {
      for (var k in byTabindex[j]) {
        ordered.push(byTabindex[j][k]);
      }
    }

    return ordered;
  }

  /**
   * Return not disabled, tabindex!=-1, visible, tabable radio ordered by the specified tab-direction
   * @param orderByTabindex int; optional; tab-direction (-1 or 1); default is 1
   * @returns {Array}
   */
  function getFilteredFocusables (orderByTabindex) {
    // prepare argument
    orderByTabindex = typeof(orderByTabindex) === 'undefined' ? 1 : orderByTabindex;

    var
      that = this,
      focusables = that.focusables,
      filtered = [],
      doneRadios = []; // already processed radio-buttons

    // remove all elements which are not tabable
    for (var i = 0; i < focusables.length; i++) {

      var
        focusable = focusables[i],
        fitting = null,
        tabindex = focusable.getAttribute('tabindex') || 0;

      if (focusable.matches(':not([disabled])') && focusable.matches(':not([tabindex="-1"])') && (focusable.offsetWidth || focusable.offsetHeight)) { // not disabled, tabindex!=-1 & visible
        if (focusable.matches('input[type="radio"]')) { // remove all radio buttons which are not tabable
          if (doneRadios.indexOf(focusable) === -1) { // group of this radio not processed yet
            // get radio-group
            var
              radioGroup = getRadioGroup.call(that, focusable),
              focusableRadio = null;

            doneRadios = doneRadios.concat(radioGroup);

            // get tabable radios of the group (checked or first&last of group)
            for (var j = 0; j < radioGroup.length; j++) {
              var radio = radioGroup[j];
              if (radio.checked) {
                focusableRadio = radio;
                break;
              }
            }
            if (!focusableRadio) {
              focusableRadio = orderByTabindex === -1 ? radioGroup[radioGroup.length-1] : radioGroup[0]; // default is tabable in tab-direction!!!
            }
            fitting = focusableRadio;
          }

        } else {
          fitting = focusable;
        }
      }

      if (fitting) {
        filtered.push(fitting);
      }
    }

    return filtered;
  }

  function focusFirst(tabables) {
    var
      that = this,
      taboutIndicator = that.options.taboutIndicator,
      focusNext = tabables[0];

    if (focusNext.matches(taboutIndicator)) {
      focusNext = tabables[1];
    }

    if (focusNext.matches('iframe'))
      setTimeout(function () {
        focusNext.contentWindow.focus();
      }, 100);
    else {
      focusNext.focus();
    }
  }

  function focusLast(tabables) {
    var
      that = this,
      taboutIndicator = that.options.taboutIndicator,
      focusNext = tabables[tabables.length - 1];

    if (focusNext.matches(taboutIndicator)) {
      focusNext = tabables[tabables.length - 2];
    }

    if (focusNext.matches('iframe'))
      setTimeout(function () {
        focusNext.contentWindow.focus();
      }, 100);
    else {
      focusNext.focus();
    }
  }

  function taboutFocus(event) {
    var
      that = this,
      element = event.target,
      tabableTab = getFilteredFocusables.call(that,1),
      tabableBackTab = getFilteredFocusables.call(that,-1);

    if (element == tabableBackTab[0]) { // focus on start-focus-out -> focus last element
      focusLast.call(that,tabableBackTab);

    } else if (element == tabableTab[tabableTab.length - 1]) { // focus on end-focus-out -> focus first element
      focusFirst.call(that,tabableTab);
    }

  }


  /*
   ---------------
   prototype
   ---------------
   */

  /**
   * Update the list of focusable elements. Call this, if the focusable elements within the container change (elements are added or removed)
   * @returns this
   */
  meTrapFocus.prototype.update = function () {
    return fetchFocusables.call(this);
  };

  /**
   * Get all possibly focusable elements
   * @returns {[]} DOM-elements
   */
  meTrapFocus.prototype.getFocusables = function () {
    return meTools.copyValues(this.focusables, false);
  };

  /**
   * Get all elements reachable by (back-) tab
   * @param backTab boolean; optional; default is false
   * @returns {[]} DOM-elements
   */
  meTrapFocus.prototype.getTabable = function (backTab) {
    return meTools.copyValues(backTab ? getFilteredFocusables.call(this,-1) : getFilteredFocusables.call(this,1), false);
  };

  /**
   * Destroy the instance
   * @returns {null}
   */
  meTrapFocus.prototype.destroy = function () {
    var that = this;

    initProperties.call(that);
    meTools.unregisterEvent(that);

    return null;
  };

  return meTrapFocus;

}));
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define('meDialog',['meTools', 'meLockView', 'meShowTransition', 'meTrapFocus'], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory(meTools, meLockView, meShowTransition, meTrapFocus);
  } else {
    root.meShowTransition = factory(meTools, meLockView, meShowTransition, meTrapFocus);
  }
}(this, function (meTools, meLockView, meShowTransition, meTrapFocus) {

  var

  /*
   ---------------
   constants
   ---------------
   */

  // code of the escape key
    KEY_ESCAPE = 27,

  // if this attribute is set on a dialog container, the dialog will be initialized automatically
    AUTO_INIT = "data-me-dialog",

  // if this attribute is set on an element with the id of the dialog container as value, click on the element will show the dialog (data-me-show-dialog="DIALOG-ID")
    TRIGGER_SHOW = "data-me-show-dialog",

  /*
   ---------------
   settings
   ---------------
   */


    defaultOptions = {
      // set if the dialog is modal; default is true
      modal: true,

      // only relevant if modal=true
      // - selector identifying the backdrop element within the dialog, OR
      // - backdrop element
      backdrop: '.me-backdrop',

      // only relevant if modal=true
      // close the dialog on click on the backdrop; o
      // Note: if true, the behaviour is not according to the WAI ARIA best practices!
      closeOnBackdrop: false,

      // "the label should briefly and adequately describe the dialogs use"
      // - selector identifying the labeling element within the dialog, OR
      // - label text, OR
      // - labelling element
      label: '.me-label',

      // selector identifying the close button(s) within the dialog
      closeSelector: '.me-close',

      // class added to the close button, if the (external) backdrop should not be hidden on close/click
      keepBackdropIndicator: 'me-keep-backdrop',

      // the dialog requires confirmation (like a js confirm box), so ESC will not close the dialog
      requireConfirm: false,

      // attribute set on the container with the view properties passed onShow as value; use this to set states for a specific view of the dialog (e.g. show/hide elements etc.)
      viewPropsAttribute: 'data-view-props',

      // custom action handlers; false for automatic handling or fn
      customHandler: {
        // fn(container) returning an element within the dialog to focus; or false to use the default
        focus: false
      },

      // false or fn(params); params = {container: CONTAINER,backdrop:BACKDROP,trigger:TRIGGER,immediate:BOOL (immediate show/hide call - no transition)}
      callbacks: {
        beforeShow: false,
        beforeShowTransition: false,
        afterShowTransition: false,
        afterShow: false,
        beforeHide: false,
        beforeHideTransition: false,
        afterHideTransition: false,
        afterHide: false
      },

      // see meLockView
      lockView: true,

      // prefix for generated IDs
      idPrefix: 'id-'
    }
    ;

  /*
   ---------------
   meDialog
   ---------------
   */

  /**
   * Create a new instance
   * @param container mixed; required; element or element-id of the dialog element
   * @param options object; optional; overwrite the default settings
   */
  function meDialog(container, options) {
    var that = this;

    // merge options
    initProperties.call(that).options = meTools.mergeObjects(defaultOptions, options);

    initDialog.call(that, container);

  }


  /*
   ---------------
   private functions
   ---------------
   */

  /* setup */

  function initProperties() {
    var that = this;

    that.shown = false; // true from beginning of show until beginning of hide
    that.options = {};

    that.container = null;
    that.backdrop = null;
    that.trigger = null;

    that.meTrapFocus = null;
    that.mainShowTransition = null;
    that.backdropShowTransition = null;

    that.keepBackdrop = false;

    return that;
  }

  function initDialog(container) {
    var
      that = this,
      options = that.options;

    // check arguments
    that.container = initContainer.call(that, container);

    if (options.modal) {
      that.backdrop = initBackdrop.call(that);
    }

    setLabel.call(that);
    initCloseBtn.call(that);
    initFocus.call(that);
    initShow.call(that);
    initTriggers.call(that);

    hide.call(that, true);

    return that;
  }

  function initContainer(container) {
    // get element
    var
      that = this,
      containerElement = meTools.getElementById(container);

    if (!containerElement) {
      throw 'meDialog: Container element not found';
    }

    // set role
    containerElement.setAttribute('role', 'dialog');

    // register events
    meTools.registerEvent(that, containerElement, 'click', function (event) {
      handleClick.call(that, event);
    });
    meTools.registerEvent(that, containerElement, 'keydown', function (event) {
      handleKeyboard.call(that, event);
    });
    meTools.registerEvent(that, containerElement, 'showdialog', function (event) {
      triggeredShow.call(that, event.detail);
    });
    meTools.registerEvent(that, containerElement, 'hidedialog', function (event) {
      triggeredHide.call(that);
    });

    return containerElement;
  }

  function initBackdrop() {
    var
      that = this,
      options = that.options,
      container = that.container,
      backdropDef = options.backdrop,
      backdropElement = false;

    if (typeof(backdropDef) === 'string') {
      backdropElement = container.querySelector(backdropDef);
    } else if (backdropDef && typeof(backdropDef) === 'object' && typeof(backdropDef.tagName) !== 'undefined') {
      backdropElement = backdropDef;
    }

    if (!backdropElement) {
      throw 'meDialog: Backdrop element not found';
    }

    backdropElement.setAttribute('tabindex', '-1'); // "Set the tabindex of the backdrop element to tabindex="-1" to prevent it from receiving focus via a keyboard event or mouse click."

    meTools.registerEvent(that, backdropElement, 'click', function (event) {
      handleBackdropClick.call(that, event.target);
    });

    // set meShowTransition on the backdrop if it is not contained in the main dialog container
    if (!meTools.isParent(that.container, backdropElement)) {
      // build meShowTransition options
      var _options = meTools.copyValues(that.options);
      _options.callbacks = {}; // remove all callbacks
      that.backdropShowTransition = new meShowTransition(backdropElement, _options);
    }

    return backdropElement;
  }

  function setLabel() {
    var
      that = this,
      options = that.options,
      container = that.container,
      labelDef = options.label,
      labelElement = false;

    if (typeof(labelDef) === 'string') {
      labelElement = container.querySelector(labelDef);
    } else if (typeof(labelDef) === 'object' && typeof(labelDef.tagName) !== 'undefined') {
      labelElement = labelDef;
    }

    if (labelElement) {
      container.setAttribute('aria-labelledby', meTools.getId(labelElement, options.idPrefix));

    } else if (typeof(labelDef) === 'string') {
      container.setAttribute('aria-label', labelDef);

    } else {
      throw 'meDialog: Label element not found';
    }

    return that;
  }

  function initCloseBtn() {
    var
      that = this,
      closeButtons = that.container.querySelectorAll(that.options.closeSelector),
      _hide = function () {
        if (this.className.indexOf(that.options.keepBackdropIndicator) !== -1) {
          that.keepBackdrop = true;
        }
        hide.call(that);
      };

    for (var i = 0; i < closeButtons.length; i++) {
      meTools.registerEvent(that, closeButtons[i], 'click', _hide);
    }

    return that;
  }

  function initFocus() {
    var
      that = this,
      container = that.container;

    that.meTrapFocus = new meTrapFocus(container, that.options);

    // add tabindex to the dialog to be able to focus it if there is no focusable element inside
    var currentTabindex = container.getAttribute('tabindex');
    if (!currentTabindex && currentTabindex !== 0) {
      container.setAttribute('data-tabindexed', 'true');
      container.setAttribute('tabindex', '-1');
    }

    return that;
  }

  function initShow() {
    var
      that = this,
      options = that.options,
      callbacks = options.callbacks,

    // build meShowTransition options
      _options = meTools.copyValues(options);
    _options.callbacks = {}; // remove all callbacks

    /* adjust callbacks */

    // call user-defined callback
    function customCallback(data, name) {
      if (callbacks[name]) {

        // add custom properties
        data.backdrop = that.backdrop;
        data.trigger = that.trigger;

        callbacks[name](data);
      }
    }

    function passCustomCallback(name) {
      return function (data) {
        customCallback(data, name);
      };
    }

    function beforeShow(data) {

      // call user-defined beforeShow
      customCallback(data, 'beforeShow');

      // show the backdrop
      if (that.backdropShowTransition) {
        that.backdropShowTransition.show(data.immediate);
      }

      // lock the view
      if (options.lockView) {
        meLockView.lock();
      }

      // set wai-aria attributes
      if (that.trigger) {
        that.trigger.setAttribute('aria-expanded', 'true');
      }
      that.container.setAttribute('aria-hidden', 'false');

    }

    function afterShow(data) {

      // fetch the focusable elements
      that.meTrapFocus.update();

      // set the focus inside of the dialog
      setFocus.call(that);

      // call user-defined beforeShowTransition
      customCallback(data, 'afterShow');
    }

    function beforeHide(data) {

      // call user-defined beforeHide
      customCallback(data, 'beforeHide');

      // hide the backdrop
      if (that.backdropShowTransition && !that.keepBackdrop) {
        that.backdropShowTransition.hide(data.immediate);
      }

      // focus the trigger
      if (that.trigger) {
        // set wai-aria attributes
        that.trigger.setAttribute('aria-expanded', 'false');
        unsetTrigger.call(focusTrigger.call(that));
      }

    }

    function afterHide(data) {

      // clear the view specific properties
      clearViewProps.call(this);

      // unlock the view
      if (options.lockView && !that.keepBackdrop) {
        meLockView.unlock();
      }
      that.keepBackdrop = false;

      // set wai-aria attributes
      that.container.setAttribute('aria-hidden', 'true');

      // call user-defined afterHide
      customCallback(data, 'afterHide');

    }

    _options.callbacks = { // false or fn(params); params = {container: CONTAINER,backdrop:UNDERLAY,trigger:TRIGGER,immediate:BOOL (immediate show/hide call - no transition)}
      beforeShow: beforeShow,
      beforeShowTransition: passCustomCallback('beforeShowTransition'),
      afterShowTransition: passCustomCallback('afterShowTransition'),
      afterShow: afterShow,
      beforeHide: beforeHide,
      beforeHideTransition: passCustomCallback('beforeHideTransition'),
      afterHideTransition: passCustomCallback('afterHideTransition'),
      afterHide: afterHide
    };


    // init meShowTransition
    that.mainShowTransition = new meShowTransition(that.container, _options);

    return that;
  }

  function initTriggers() {
    var
      that = this,
      dialogId = meTools.getId(that.container, that.options.idPrefix),
      triggers = document.querySelectorAll('[' + TRIGGER_SHOW + '="' + dialogId + '"]'),
      _show = function () {
        that.show(this);
      };

    for (var i = 0; i < triggers.length; i++) {
      var trigger = triggers[i];
      trigger.setAttribute('aria-controls', dialogId);
      meTools.registerEvent(that, triggers[i], 'click', _show);
    }

    return that;
  }

  /* display */

  /**
   *
   * @param immediate Bool; show immediately (without transition)
   * @param viewProps
   * @returns {show}
   */
  function show(immediate, viewProps) {
    addViewProps.call(this, viewProps);
    this.mainShowTransition.show(immediate);
    return this;
  }

  function hide(immediate) {
    this.mainShowTransition.hide(immediate);
    return this;
  }

  function addViewProps(viewProps) {
    var that = this;
    if (viewProps) {
      that.container.setAttribute(that.options.viewPropsAttribute,viewProps);
    }
    return that;
  }

  function clearViewProps() {
    var that = this;
    that.container.removeAttribute(that.options.viewPropsAttribute);
    return that;
  }

  /* events */

  function triggeredShow(detail) {
    this.show(detail.trigger);
  }

  function triggeredHide() {
    this.hide();
  }

  function handleClick(event) {
    var
      that = this,
      options = that.options;
  }

  function handleKeyboard(event) {
    if (!event.ctrlKey && !event.altKey) {
      var code = (event.keyCode ? event.keyCode : event.which);

      if (!this.options.requireConfirm && code == KEY_ESCAPE) {
        hide.call(this);
        event.stopPropagation();
      }
    }
  }

  function handleBackdropClick(target) {
    var that = this;

    if (that.backdrop == target) {
      if (that.options.closeOnBackdrop) {
        hide.call(that);
      } else {
        that.container.focus();
      }
    }

    return that;
  }

  /* handle trigger element */

  function setTrigger(trigger) {
    this.trigger = trigger;
    return this;
  }

  function focusTrigger() {
    var that = this;
    if (that.trigger) {
      that.trigger.focus();
    }
    return that;
  }

  function unsetTrigger() {
    this.trigger = null;
    return this;
  }

  /* focus */

  function setFocus() {
    var
      that = this,
      options = that.options,
      getFocusElement = options.customHandler.focus,
      focus = null,
      focusables = that.meTrapFocus.getTabable();

    if (typeof getFocusElement === 'function') {
      focus = getFocusElement(that.container);
    }
    if (!focus) {
      for (var i = 0; i < focusables.length; i++) {
        if (!focusables[i].matches(options.closeSelector)) {
          focus = focusables[i];
          break;
        }
      }
    }
    if (!focus && focusables.length) {
      focus = focusables[0];
    }

    (focus || (focusables.length ? focusables[0] : that.container)).focus();
  }

  /*
   ---------------
   prototype
   ---------------
   */

  /**
   * Show the dialog
   * @param trigger DOM-element; optional; the element, that triggered the show
   * @param immediate Bool; optional; default is false; show immediately (without transition)
   * @param viewProps String; optional; string to add to the container in the viewPropsAttribute
   * @returns {meDialog}
   */
  meDialog.prototype.show = function () {
    var
      that = this,
      trigger,
      immediate,
      viewProps;
    for (var i=0; i<arguments.length; i++) {
      var
        argument = arguments[i],
        type = typeof argument;

      if (type === 'boolean') {
        immediate = argument;
      } else if (type === 'string') {
        viewProps = argument;
      } else if (type === 'object' && argument.tagName) {
        trigger = argument;
      }
    }
    if (trigger) {
      setTrigger.call(that, trigger);
    }
    return show.call(that, immediate, viewProps);
  };

  /**
   * Hide the dialog
   * @returns {meDialog}
   */
  meDialog.prototype.hide = function () {
    return hide.call(this);
  };

  /**
   * Update the list of focusable elements in the dialog.
   * Call this function, if elements were added or removed while the dialog is shown
   * @returns {meDialog}
   */
  meDialog.prototype.update = function () {
    this.meTrapFocus.update();
    return this;
  };

  /**
   * @returns {boolean} true if the component is in the process of hiding or hidden
   */
  meDialog.prototype.canShow = function () {
    return this.mainShowTransition.canShow();
  };

  /**
   * Destroy the widget
   * @returns {null}
   */
  meDialog.prototype.destroy = function () {
    var
      that = this,
      container = that.container;

    container.removeAttribute('role');
    container.removeAttribute('aria-hidden');
    container.removeAttribute('aria-labelledby');
    container.removeAttribute('aria-label');

    that.backdrop.removeAttribute('tabindex');
    if (container.getAttribute('data-tabindexed')) {
      container.removeAttribute('data-tabindexed');
      container.removeAttribute('tabindex');
    }

    if (that.trigger) {
      that.trigger.removeAttribute('aria-expanded');
    }

    meTools.unregisterEvent(that);

    that.meTrapFocus.destroy();
    that.mainShowTransition.destroy();
    if (that.backdropShowTransition) {
      that.backdropShowTransition.destroy();
    }

    initProperties.call(that);

    return null;
  };

  /*
   ---------------
   automatic initialization
   ---------------
   */

  /**
   * Auto init all dialogs with the attribute AUTO_INIT
   */
  function autoInit() {
    var dialogs = document.querySelectorAll('[' + AUTO_INIT + ']');
    for (var i = 0; i < dialogs.length; i++) {
      new meDialog(dialogs[i]);
    }
  }

  // auto-initialize marked dialogs as soon as the document has finished loading. We can now access the DOM elements.
  if (document.readyState !== 'loading') {
    autoInit();
  } else {
    window.addEventListener('DOMContentLoaded', function loaded() {
      window.removeEventListener('DOMContentLoaded', loaded);
      autoInit();
    });
  }

  /*
   ---------------
   return
   ---------------
   */

  return meDialog;

}));
/***********************************************************************************************************************
 * MATCHES
 * Add matches support for all IEs and others (http://caniuse.com/#feat=matchesselector)
 **********************************************************************************************************************/
// as described in https://developer.mozilla.org/en/docs/Web/API/Element/matches#Browser_compatibility
(function(ElementPrototype) {
  ElementPrototype.matches = ElementPrototype.matches ||
  ElementPrototype.matchesSelector ||
  ElementPrototype.mozMatchesSelector ||
  ElementPrototype.msMatchesSelector ||
  ElementPrototype.oMatchesSelector ||
  ElementPrototype.webkitMatchesSelector ||
  function (selector) {
    var $element = this
      , $matches = [].slice.call(document.querySelectorAll(selector))
      ;
    return $matches.indexOf($element)!==-1;
  }
})(Element.prototype);


define("matchesPolyfill", (function (global) {
    return function () {
        var ret, fn;
        return ret || global.matchesPolyfill;
    };
}(this)));



  return require('meDialog');
}));

/**
 * @license me-dialog 1.0.8 Copyright (c) Mandana Eibegger <scripts@schoener.at>
 * Available via the MIT license.
 * see: https://github.com/meibegger/me-dialog for details
 */
