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
            end: start + $v.text().length
          });
        }

        // Why not tail recursion? We need top level tag first.
        // Get internal markups --> Inception
        _getMarkups($v, result, start);
      }
      start = start + $v.text().length;
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
    $content.find('.se-elem').each(function(){
      var obj = _getParagraphModel($(this));
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
        result.push(_getHTMLFromMarkup(b.text, b.markups));
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


      for (var sk in spNames) {
        var svalue = spNames[sk].value,
            sindex = spNames[sk].index;
        if (!tpNames[sk]) {
          // If `target.paragraph` is not available with the `name` in
          // `source.paragraph` then mark paragraph as deleted
          deltas.push({
            index: sindex,
            type: opTypes.DELETE
          });
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
      if ((dType !== opTypes.CREATE && typeof sp[dIndex] == 'undefined') ||
          (dType === opTypes.CREATE && typeof sp.length < dIndex - 1)) {
        throw new Error("Delta is not valid for this source");
      }

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
// Smalleditor module
var smalleditor = angular.module('smalleditor');

// Smalleditor services
smalleditor.service('SmalleditorService', function() {
  // check browser
  this.isFirefox = navigator.userAgent.match(/firefox/i);
  this.isChrome = navigator.userAgent.match(/chrome/i);

  // set caret at the end of the text (cross browser)
  // http://stackoverflow.com/questions/4233265/contenteditable-set-caret-at-the-end-of-the-text-cross-browser
  this.setCaret = function(el){
    if (typeof window.getSelection != "undefined" && typeof document.createRange != "undefined") {
      var range = document.createRange();
      if (!range) return;
      range.selectNodeContents(el);
      range.collapse(false);
      if (this.isFirefox) {
        range.setEndBefore($(el).find('br').get(0));
      }
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } else if (typeof document.body.createTextRange != "undefined") {
      var textRange = document.body.createTextRange();
      textRange.moveToElementText(el);
      textRange.collapse(false);
      textRange.select();
    }
  };

  // http://stackoverflow.com/questions/1197401/how-can-i-get-the-element-the-caret-is-in-with-javascript-when-using-contenteditable
  this.getSelectionStart = function(){
    var node = document.getSelection().anchorNode,
        startNode = (node && node.nodeType === 3 ? node.parentNode : node);
    return startNode;
  };

  // http://stackoverflow.com/questions/15867542/range-object-get-selection-parent-node-chrome-vs-firefox
  this.rangeSelectsSingleNode = function(range) {
    var startNode = range.startContainer;
    return startNode === range.endContainer &&
      startNode.hasChildNodes() &&
      range.endOffset === range.startOffset + 1;
  };

  this.getSelectedParentElement = function(){
    var spe = null;
    var selection = window.getSelection();
    var range = selection.getRangeAt(0);
    if (this.rangeSelectsSingleNode(range)) {
      spe = range.startContainer.childNodes[range.startOffset];
    } else if (range.startContainer.nodeType === 3) {
      spe = range.startContainer.parentNode;
    } else {
      spe = range.startContainer;
    }
    return spe;
  };
});



// Define `smalleditor` directive
smalleditor.directive('smalleditor', [
  '$timeout',
  'SmalleditorCore',
  'SmalleditorService',
  function ($timeout, seUtils, seService) {
    'use strict';
    return {
      scope: {
        api: '=?api'
      },
      templateUrl: 'views/_se_toolbar.html',
      link: function (scope,  element, attrs) {

        // scope api
        var api = scope.api = {};

        // set default toolbar position
        scope.position = {
          top: 10,
          left: 10,
          // triangle direction
          below: false
        };

        // available buttons
        scope.buttons = {};
        (attrs.buttons || "b,i").split(',').reduce(function(o, k){
          var key = k.trim().toLowerCase();
          if (key) {
            o[key] = true;
          }
          return o;
        }, scope.buttons);

        // enable/disable toolbar
        scope.enableToolbar = (attrs.enabletoolbar != 'false'); // By default `true`

        // default toolbar status and placeholder
        scope.showToolbar = (attrs.showtoolbar == 'true'); // By default `false`
        scope.showPlaceholder = false;

        // placeholder text
        scope.placeholder = attrs.placeholder || "Type your text";

        // Text paste
        scope.allowPaste = (attrs.paste != 'false');
        scope.plainPaste = (attrs.plain_paste != 'false');
        scope.htmlPaste = (attrs.html_paste == 'true');

        // block tags
        var blockTags = "p h1 h2 h3 h4 h5 h6 pre blockquote".split(' ');
        var blockSelector = blockTags.join(',');
        // unwanted tags
        var unwantedTags = "span em strong mark".split(' ');
        var unwantedSelector = unwantedTags.join(',');

        // toolbar container
        var $toolbar = element.find('.smalleditor-toolbar');
        // content container
        var $content = element.find('.smalleditor-content');
        // get body
        var $body = angular.element(document.getElementsByTagName('body'));

        // make content editable
        $content.attr('contenteditable', true);

        // Generate random number
        var generateRandomName = function() {
          return seUtils.generateRandomName();
        };

        // position the toolbar above or below the selected text
        var setToolbarPosition = function () {
          var toolbarHeight = $toolbar[0].offsetHeight;
          var toolbarWidth = $toolbar[0].offsetWidth;
          var spacing = 5;
          var selection = window.getSelection();
          var range = selection.getRangeAt(0);
          var boundary = range.getBoundingClientRect();

          var topPosition = boundary.top;
          var leftPosition = boundary.left;

          // if there isn't enough space at the top,
          // place it at the bottom of the selection
          if(boundary.top < (toolbarHeight + spacing)) {
            scope.position.top = topPosition + boundary.height + spacing;
            // set toolbar position if it's above or below the selection
            // used in the template to place the triangle above or below
            scope.position.below = true;
          } else {
            scope.position.top = topPosition - toolbarHeight - spacing;
            scope.position.below = false;
          }

          // center toolbar above selected text
         scope.position.left = leftPosition - (toolbarWidth/2) + (boundary.width/2);

         // cross-browser window scroll positions
         var scrollLeft = (window.pageXOffset !== undefined) ?
             window.pageXOffset :
             (document.documentElement || document.body.parentNode || document.body).scrollLeft;
         var scrollTop = (window.pageYOffset !== undefined) ?
             window.pageYOffset :
             (document.documentElement || document.body.parentNode || document.body).scrollTop;

         // add the scroll positions
         // because getBoundingClientRect gives us the position
         // relative to the viewport, not to the page
         scope.position.top += scrollTop;
         scope.position.left += scrollLeft;

         return this;
        };

        // get current selection and act on toolbar depending on it
        var checkSelection = function (e) {
          // if you click something from the toolbar don't do anything
          if(e && e.target && $toolbar.find(e.target).length) {
            return false;
          }

          // get new selection
          var newSelection = window.getSelection();

          // get selection node
          var anchorNode = newSelection.anchorNode;
          if (!anchorNode) {
            scope.showToolbar = false;
            return this;
          }

          // check if selection is in the current editor/directive container
          var parentNode = anchorNode.parentNode;
          while (parentNode.tagName !== undefined && parentNode !== $content.get(0)) {
            parentNode = parentNode.parentNode;
          }

          // if the selection is in the current editor
          if(parentNode === $content.get(0)) {
            // show the toolbar
            $timeout(function() {
              if(newSelection.toString().trim() === '' || !anchorNode) {
                scope.showToolbar = false;
              } else {
                scope.showToolbar = true;
                setToolbarPosition();
              }
            });
            // check selection styles and active buttons based on it
            checkActiveButtons();
          } else {
            // hide the toolbar
            $timeout(function() {
              scope.showToolbar = false;
            });
          }
          return this;
        };

        // Bind selection
        var bindSelection = function() {
          // check selection when selecting with the shift key
          $content.bind('keyup', checkSelection);

          // check the selection on every mouseup
          // it also triggeres when releasing outside the browser
          document.addEventListener('mouseup', checkSelection);

          var contentBlurTimer;
          $content.bind('blur', function() {
            if(contentBlurTimer) {
              clearTimeout(contentBlurTimer);
            }
            contentBlurTimer = setTimeout(checkSelection, 200);
          });
        };

        // check current selection styles and activate buttons
        var checkActiveButtons = function () {
          var parentNode = seService.getSelectedParentElement();
          scope.styles = {};
          // Iterate through all parent node and find all styles by its tagName
          while (parentNode && parentNode.tagName !== undefined && $content.get(0) != parentNode) {
            scope.styles[parentNode.tagName.toLowerCase()] = true;
            parentNode = parentNode.parentNode;
          }
        };

        // set placeholders for empty textarea
        var setPlaceholders = function() {
          var activate = function () {
            if ($content.get(0).textContent.replace(/^\s+|\s+$/g, '') === '') {
              scope.showPlaceholder = true;
            }
          };
          var deactivate = function (e) {
            scope.showPlaceholder = false;
            if (e.type !== 'keypress' && e.type !== 'paste') {
              activate();
            }
          };
          activate();
          $content.on('blur.placeholder', activate)
            .on('keypress.placeholder paste.placeholder', deactivate);
        };

        // Bind paste
        var bindPaste = function() {
          $content.on('paste.se_paste', function(e){
            e.preventDefault();
            if (!scope.allowPaste) {
              return false;
            }
            var oe = (e.originalEvent || e);
            if (oe.clipboardData) {
              if (oe.clipboardData.getData('text/plain') && scope.plainPaste) {
                var paragraphs = oe.clipboardData.getData('text/plain').split(/[\r\n]/g);
                var html = "";
                for (var p = 0; p < paragraphs.length; p += 1) {
                  if (paragraphs[p].trim() !== '') {
                    var ep = seUtils.htmlEntities(paragraphs[p].trim());
                    if (ep) {
                      if (p === 0) {
                        html += ep;
                      } else {
                        html += '<p name="' + generateRandomName() + '" class="se-elem se-elem--p">' + ep + '</p>';
                      }
                    }
                  }
                }
                if (!!html) {
                  document.execCommand('insertHTML', false, html);
                }
              } else if (oe.clipboardData.getData('text/html') && scope.htmlPaste) {
                // TODO HTML cleanup and paste
              }
            }
          });
        };

        // Avoid nested block tags
        var removeNested = function() {
          $content.find('> .se-elem').find(blockSelector).contents().unwrap();
        };

        // Remove unwanted
        var bindRemoveUnwanted = function() {
          // Prssing Enter/Deleting in `<blockquote>, <h1>, <h2> ...` generates `p` tags,
          // find closest `.se-elem` element and remove those `p` tags
          // Avoid `p` tag inside `block` tags like `blockquote`, `h1`, `h2`
          $content.on('keyup.internal_noise, paste.internal_noise, focus.internal_noise', function(){
            $timeout(function(){
              // firefox adds `<br type=_moz></br>`
              $content.find('> br[type=_moz], > br').remove();
              // chrome adds `<span style="...">text</span>` on backspace
              $content.find(unwantedSelector).contents().unwrap();
              $content.find('[style]').removeAttr('style');
              removeNested();
            });
          });
        };

        // Add first element class on every change
        // TODO why we need this? - remove it
        var addedNewElem = function() {
          $content.find('.se-elem--first').removeClass('se-elem--first');
          $content.find('.se-elem').first().addClass('se-elem--first');
        };

        // creates named paragraph with class`se-elem se-elem--p`
        var createNamedParagraph = function() {
          var newP = $('<p>', {
            name: generateRandomName(),
            class: 'se-elem se-elem--p'
          }).appendTo($content);
          newP.append('<br/>');
          seService.setCaret(newP.get(0));

          addedNewElem();

          return newP;
        };

        // Bind wrapping elements
        var bindWrapElements = function() {
          $content.on('blur keyup paste focus', function(){
            // If no `.se-elem` is there, create first paragraph
            var pList = $content.find('.se-elem');
            if (pList.size() === 0) {
              createNamedParagraph();
            }

            // wrap content text in p to avoid firefox problems
            $content.contents().each((function() {
              return function(index, field) {
                if (field.nodeName === '#text') {
                  document.execCommand('insertHTML',
                    false,
                    "<p name=" + generateRandomName() + " class='se-elem se-elem--p'>" + field.data + "<br/></p>");
                  addedNewElem();
                  return field.remove();
                }
              };
            })(this));
          });
        };

        // Bind create new
        var bindParagraphCreation = function() {
          $content.on('keyup.paragraph_creation', function(e){
            // Process only enter key
            if (e.which === 13) {
              if (!e.shiftKey) {
                // Insert `p` tag on enter
                document.execCommand('formatBlock', false, 'p');

                // Get closest `.se-elem`, add `name` and `class` to that element.

                // Enter key on `bold`, `italic` or `underline` elements generates `b` tag
                // and becomes `<p name='...' class='...'><b>example<b><p>`,
                // in that case find closest `.se-elem` add name/class attributes
                var node = seService.getSelectionStart();
                var closest = $(node).closest('.se-elem');
                if (closest.size() === 0) {
                  closest = $(node);
                }
                closest.attr('name', generateRandomName()).addClass('se-elem se-elem--p');
                addedNewElem();
              }
            }
          });
        };

        // Setup editor
        var setup = function () {
          setPlaceholders();
          bindSelection();
          bindPaste();
          bindParagraphCreation();
          bindRemoveUnwanted();
          bindWrapElements();
        };

        // simple edit action - bold, italic, underline
        scope.SimpleAction = function(action, elem) {
          elem = elem && elem.toLowerCase();
          document.execCommand('styleWithCSS', false, false);
          document.execCommand(action, false, elem);
          if (action == 'formatBlock') {
            var node = seService.getSelectionStart();
            var closest = $(node).closest(elem);
            if (closest.size() === 0) {
              closest = $(node).prev(elem);
            }
            closest.attr('name', generateRandomName()).addClass('se-elem se-elem--' + elem);
            removeNested();
            addedNewElem();
          }
        };

        // move the toolbar to the body,
        // we can use overflow: hidden on containers
        $body.append($toolbar);

        // setup editor
        setup();


        //
        // APIs
        //

        // Get current data model
        api.dataModel = function(dataModel) {
          if (!dataModel) {
            return seUtils.generateModel($content);
          }
          $content.html(seUtils.generateHTMLFromModel(dataModel));
        };

        // Get html from data model
        api.getHTML = function(dataModel) {
          if (!dataModel) {
            return null;
          }
          return seUtils.generateHTMLFromModel(dataModel);
        };

        // compute delta
        api.computeDelta = seUtils.computeDelta;
        // apply delta
        api.applyDelta = seUtils.applyDelta;
      }
    };
  }
]);
angular.module('smalleditor').run(['$templateCache', function($templateCache) {
  'use strict';

  $templateCache.put('views/_se_toolbar.html',
    "<div class=\"smalleditor\">\n" +
    "  <div class=\"smalleditor-toolbar\" style=\"top: {{ position.top }}px; left: {{ position.left }}px\" ng-class=\"{ 'smalleditor-toolbar--show': showToolbar, 'smalleditor-toolbar--bottom': position.below }\">\n" +
    "    <div class=\"se-toolbar-inner\">\n" +
    "      <ul class=\"se-main-toolbar\">\n" +
    "        <li class=\"se-li\" ng-show=\"buttons.b\">\n" +
    "          <button type=\"button\" ng-click=\"SimpleAction('bold')\" class=\"se-button se-button--bold\" ng-class=\"{ 'se-button--active': styles.b }\">\n" +
    "            <b>B</b>\n" +
    "          </button>\n" +
    "        </li>\n" +
    "        <li class=\"se-li\" ng-show=\"buttons.i\">\n" +
    "          <button type=\"button\" ng-click=\"SimpleAction('italic')\" class=\"se-button se-button--italic\" ng-class=\"{ 'se-button--active': styles.i }\">\n" +
    "            <i>I</i>\n" +
    "          </button>\n" +
    "        </li>\n" +
    "        <li class=\"se-li\" ng-show=\"buttons.u\">\n" +
    "          <button type=\"button\" ng-click=\"SimpleAction('underline')\" class=\"se-button se-button--underline\" ng-class=\"{ 'se-button--active': styles.u }\">\n" +
    "            <b><u>U</u></b>\n" +
    "          </button>\n" +
    "        </li>\n" +
    "        <li class=\"se-li\" ng-show=\"buttons.h1\">\n" +
    "          <button type=\"button\" ng-click=\"SimpleAction('formatBlock', styles.h1 ? 'p' : 'h1')\" class=\"se-button se-button--h1\" ng-class=\"{ 'se-button--active': styles.h1 }\">\n" +
    "            <b>H1</b>\n" +
    "          </button>\n" +
    "        </li>\n" +
    "        <li class=\"se-li\" ng-show=\"buttons.h2\">\n" +
    "          <button type=\"button\" ng-click=\"SimpleAction('formatBlock', styles.h2 ? 'p' : 'h2')\" class=\"se-button se-button--h2\" ng-class=\"{ 'se-button--active': styles.h2 }\">\n" +
    "            <b>H2</b>\n" +
    "          </button>\n" +
    "        </li>\n" +
    "        <li class=\"se-li\" ng-show=\"buttons.blockquote\">\n" +
    "          <button type=\"button\" ng-click=\"SimpleAction('formatBlock', styles.blockquote ? 'p' : 'blockquote')\" class=\"se-button se-button--blockquote\" ng-class=\"{ 'se-button--active': styles.blockquote }\">\n" +
    "            <b>\"</b>\n" +
    "          </button>\n" +
    "        </li>\n" +
    "      </ul>\n" +
    "    </div>\n" +
    "    <div class=\"se-down-arrow-clip\">\n" +
    "      <span class=\"se-down-arrow\"></span>\n" +
    "    </div>\n" +
    "  </div>\n" +
    "  <div class=\"smalleditor-content\" ng-class=\"{'smalleditor-placeholder': showPlaceholder}\" data-placeholder=\"{{ placeholder }}\">\n" +
    "  </div>\n" +
    "</div>\n"
  );

}]);
