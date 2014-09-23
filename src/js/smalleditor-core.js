//
//  smalleditor
//
//  (c) 2014 Jaynti Kanani
//  smalleditor may be freely distributed under the MIT license.
//  For all details and documentation:
//  https://github.com/jdkanani/smalleditor
//


// Define `smalleditor` module
var smalleditor = angular.module('smalleditor', []);


// SmalleditorCore service
// It handles revision/delta computations
smalleditor.service('SmalleditorCore', function() {

  // Reference
  var seUtils = this;

  // Generate random name
  this.generateRandomName = function() {
    return Date.now().toString(36) + Math.round(1E16 * Math.random()).toString(36);
  };

  // Converts special characters (like <) into their escaped/encoded values (like &lt;).
  // This allows you to show to display the string without the browser reading it as HTML.
  this.htmlEntities = function(str) {
    var entityMap = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': '&quot;',
      "'": '&#39;',
      "/": '&#x2F;'
    };
    return String(str).replace(/[&<>"'\/]/g, function (s) {
      return entityMap[s];
    });
  };


  //
  //
  // DataModel manipulations
  //
  //

  // Paragraph tag types
  var tagTypes = {
    p: 1,
    h1: 2,
    h2: 3,
    blockquote: 4
  };
  var rTagTypes = {};
  for (var tKey in tagTypes) {
    if (tagTypes.hasOwnProperty(tKey)) {
      rTagTypes[tagTypes[tKey]] = tKey;
    }
  }

  // Markup tag types
  var markupTypes = {
    b: 1, // bold
    i: 2, // italic
    u: 3, // underline
    s: 4, // strike
    a: 5  // Anchor
  };
  var rMarkupTypes= {};
  for (var mKey in markupTypes) {
    if (markupTypes.hasOwnProperty(mKey)) {
      rMarkupTypes[markupTypes[mKey]] = mKey;
    }
  }

  // Get HTML markups
  // NOTE: Be careful with this function
  var _getMarkups = function($el, result, start) {
    var $contents = $el.contents();
    $contents.each(function(i, v) {
      var $v = $(v);
      if ($v.context && $v.context.nodeType !== 3) {
        // _getMarkups($v, result, start);

        // Add markup to result with type
        var tagName = $v.context.tagName.toLowerCase();
        var type = markupTypes[tagName];
        if (type) {
          result.push({
            type: type,
            start: start,
            end: start + seUtils.htmlEntities($v.text()).length
          });
        }

        // Why not tail recursion? We need top level tag first.
        // Get internal markups --> Inception
        _getMarkups($v, result, start);
      }
      start = start + seUtils.htmlEntities($v.text()).length;
    });
  };

  // Get html from markup
  // NOTE: Be careful - I was depressed while writing this function
  // TODO: Break this function
  var _getHTMLFromMarkup = function(text, markups) {
    markups = markups || [];
    if (!text) {
      return text;
    }

    // `starts` and `ends` cache for faster access
    var starts = {}, ends = {};
    for (var j = 0; j < markups.length; j++) {
      var m = markups[j];
      if (m.start !== null && m.end !== null) {
        starts[m.start] = starts[m.start] || [];
        starts[m.start].push(m);

        ends[m.end] = ends[m.end] || [];
        ends[m.end].push(m);
      }
    }

    var result = "";

    // Stack to track of `tag` incase of order mismatch
    var stack = [];

    // Run through `text` and add `start` + `end` tag by `type`
    for (var i = 0; i <= text.length; i++) {

      // Take `ends` first as at a point `end` tag comes before `start` tag
      if (ends[i]) {
        var ms = ends[i], ml = ends[i].length;
        while (ml > 0) {
          var mi = 0, top = stack[stack.length-1];
          // Iterate through all `end` tags at particular point (at point `i` on string `text`),
          // find the tag where `top === tag.type`
          while (mi < ms.length) {
            if (top === ms[mi].type) {
              result += "\x3c/" + rMarkupTypes[ms[mi].type] + "\x3e";
              stack.pop();
              break;
            }
            mi++;
          }
          // Remove from list after tag ends
          if (mi < ms.length) {
            ms.splice(mi, 1);
          }
          ml--;
        }
      }

      if (starts[i]) {
        var sm = starts[i];
        // Add all starts tag and push them in stack
        for (var k = 0; k < sm.length; k++) {
          var mm = sm[k];
          if (typeof rMarkupTypes[mm.type] != 'undefined') {
            stack.push(mm.type);
            result += "\x3c" + rMarkupTypes[mm.type] + "\x3e";
          }
        }
      }

      // Add text after adding text
      if (typeof text[i] != 'undefined') {
        result += text[i];
      }
    }

    // If stack if not empty, something bad happened
    if (stack.length !== 0) {
      throw new Error('Inconsistent tags');
    }
    return result;
  };

  // Get one paragraph model
  var _getParagraphModel = function($el){
    var tagName = $el.prop('tagName').toLowerCase();
    var obj = null;

    // tag type check
    if (tagName && typeof tagTypes[tagName] != 'undefined') {
      // craft object with markups, name, text and type
      var ms = [];
      _getMarkups($el, ms, 0);
      obj = {
        markups: ms,
        name: $el.attr('name'),
        text: seUtils.htmlEntities($el.text()),
        type: tagTypes[tagName]
      };
    }
    return obj;
  };

  // Generate model from DOM elements
  this.generateModel = function($content) {
    var dataModel = {
      paragraphs: []
    };
    var dp = dataModel.paragraphs;
    angular.forEach($content[0].querySelectorAll('.se-elem'), function(elem) {
      var obj = _getParagraphModel(angular.element(elem));
      if (obj) {
        dp.push(obj);
      }
    });
    return dataModel;
  };

  // Generate HTML from data model
  this.generateHTMLFromModel = function(dataModel) {
    if (!dataModel || !dataModel.paragraphs) {
      return null;
    }
    var result = [];
    for (var i = 0; i < dataModel.paragraphs.length; i++) {
      var b = dataModel.paragraphs[i];
      var t = rTagTypes[b.type];
      if (t) {
        result.push("<" + t + " name='" + b.name + "' class='se-elem se-elem--" + t + "'>");
        var text = _getHTMLFromMarkup(b.text, b.markups);
        result.push(text.replace(/^\s+|\s+$/g, '').length > 0 ? text : '<br/>');
        result.push("</" + t + ">");
      }
    }
    return result.join('');
  };


  //
  // Delta manipulations
  //

  // Operation types
  var opTypes = {
    CREATE: 1,
    DELETE: 2,
    UPDATE: 3
  };
  var rOpTypes= {};
  for (var key in opTypes) {
    if (opTypes.hasOwnProperty(key)) {
      rOpTypes[opTypes[key]] = key;
    }
  }

  // Get delta to transform source to target
  this.computeDelta = function(source, target) {
    // Result initialization
    var deltas = [];
    if (source != target) {
      var sourceParagraphs = source.paragraphs;
      var targetParagraphs = target.paragraphs;

      var spNames = sourceParagraphs.reduce(function(obj, curr, index){
        obj[curr.name] = { value: curr, index: index };
        return obj;
      }, {});
      var tpNames = targetParagraphs.reduce(function(obj, curr, index){
        obj[curr.name] = { value: curr, index: index };
        return obj;
      }, {});


      var removeCount = 0;
      for (var sk in spNames) {
        var svalue = spNames[sk].value,
            sindex = spNames[sk].index;
        if (!tpNames[sk]) {
          // If `target.paragraph` is not available with the `name` in
          // `source.paragraph` then mark paragraph as deleted
          deltas.push({
            index: sindex - removeCount,
            type: opTypes.DELETE
          });
          removeCount++;
        } else if (!angular.equals(svalue, tpNames[sk].value)) {
          // If `target.paragraph` is not same as `source.paragraph` with
          // same `name`, mark paragraph as updated
          deltas.push({
            index: tpNames[sk].index,
            paragraph: tpNames[sk].value,
            type: opTypes.UPDATE
          });
        }
      }

      // Iterate throught all target paragraphs,
      // if `target.name` is not available in source paragraphs,
      // mark that paragraph as created
      for (var tk in tpNames) {
        var tvalue = tpNames[tk].value,
            tindex = tpNames[tk].index;
        if (!spNames[tk]) {
          deltas.push({
            index: tindex,
            paragraph: tvalue,
            type: opTypes.CREATE
          });
        }
      }
    }

    // Return result with `rev` and `dt`
    return {
      rev: seUtils.generateRandomName(),
      dt: Date.now(),
      deltas: deltas
    };
  };

  // Apply delta to source
  this.applyDelta = function(source, deltas) {
    // validating source and delta objects
    if (!source || !source.paragraphs) {
      throw new Error("Invalid source object");
    } else if (!deltas || !deltas.deltas || !deltas.dt) {
      throw new Error("Invalid delta object");
    } else if (!deltas.deltas.length) {
      // If deltas is empty, result will be source object itself
      return source;
    }

    for (var i = 0; i < deltas.deltas.length; i++) {
      var delta = deltas.deltas[i],
        dp = delta.paragraph,
        sp = source.paragraphs,
        dIndex = delta.index,
        dType = delta.type;

      if (dType === opTypes.DELETE) {
        sp.splice(dIndex, 1);
      } else if (dType === opTypes.CREATE) {
        sp.splice(dIndex, 0, dp);
      } else if (dType === opTypes.UPDATE) {
        sp[dIndex] = dp;
      }
    }
    return source;
  };
});
