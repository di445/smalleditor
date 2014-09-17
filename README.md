Smalleditor
===========
Small WYSIWYG editor with delta save


Inspired by Medium and [MediumEditor](https://github.com/daviferreira/medium-editor).

Smalleditor uses model to save document - which makes autosaving, revisions and paragraph/word comments very easy to implement.
If you are interested in its internals, read this - <https://medium.com/medium-eng/why-contenteditable-is-terrible-122d8a40e480>


For future developement please refer TODO section.
If you need collaborative editor - I would suggest you to use [quilljs](quilljs.com).


###TODO###
- Refactor grunt setup
- Support for more elements
- IE/safari support
- Test cases
- Docs
- Side comments


###Demo###
Check out a sweet demo of smalleditor here: <http://jdkanani.github.io/smalleditor>


###How to use###
**Install using bower**
```
bower install smalleditor
```

**Include js and css**

*Dependencies:* jQuery and angular.js

```
<link rel="stylesheet" href="bower_components/smalleditor/dist/css/smalleditor.css" type="text/css" media="screen" charset="utf-8">
<script src="bower_components/smalleditor/dist/js/smalleditor.min.js" type="text/javascript" charset="utf-8"></script>
```

**Use `smalleditor` directive**
```html
<div smalleditor>
</div>
```

###Docs###

**Buttons**

Add `buttons` attribute:

```html
<div smalleditor buttons="b,i,u,h1,h2,blockquote">
</div>
```

**Icon theme**

```html
<div smalleditor buttons="b,i,u,h1,h2,blockquote" icontheme='bootstrap'>
</div>
```

**Smalleditor APIs**

Use `api` attribute in directive:

```html
<div smalleditor api='editorApi' ng-controller='EditorController'>
</div>
```

In controller use that API to control revisions:

```js
angular.module('smalleditorDemo', ['ngRoute', 'smalleditor'])
.controller('EditorController', ['$scope', function($scope) {
  $scope.$watch('editorApi', function(editor) {
    // Get current data model
    var baseDataModel = editor.dataModel();

    // After editing for a while get new data model
    var currentDataModel = editor.dataModel();

    // Compute delta between baseDataModel and currentDataModel
    var delta = editor.computeDelta(baseDataModel, currentDataModel);

    // Apply that delta to any revision to get next revision
    editor.applyDelta(nRevision, nDelta);
  });
}]);
```

###LICENSE###

MIT
