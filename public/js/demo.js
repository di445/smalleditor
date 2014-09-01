(function(){
  angular.module('smalleditorDemo', ['ngRoute', 'smalleditor'])
  .controller('EditorController', ['$scope', '$sce', function($scope, $sce) {

    // Watch for editor apis
    $scope.$watch('api', function(editor){
      if (editor) {
        // Save baseModel
        $scope.baseModel = editor.dataModel();

        // Start from `baseModel`
        var lastModel = $scope.baseModel;
        setInterval(function(){
          $scope.$apply(function(){
            // Show message
            $scope.saving = true;

            // compute delta and add to the revisions
            var currentModel = editor.dataModel();
            var delta = editor.computeDelta(lastModel, currentModel);
            // add revNumber to delta
            addRevision(delta);

            // update last revision
            lastModel = currentModel;

            // Hide saving message
            $scope.saving = false;
          });
        }, 10000);
      }
    });

    // Revisions
    $scope.revisions = [];
    var revNumber = 0;
    var addRevision = function(delta) {
      if (delta.deltas.length > 0) {
        delta.revNumber = ++revNumber;
        $scope.revisions.push(delta);
      }
    };

    // Show revision
    $scope.showRevision = function(delta) {
      // Get a copy of baseModel
      var revisionModel = angular.copy($scope.baseModel);

      // Apply delta to baseModel till we find target revision
      var revisions = $scope.revisions;
      for (var i = 0; i < revisions.length; i++) {
        var revision = revisions[i];
        $scope.api.applyDelta(revisionModel, revision);
        if (revision.rev == delta.rev) {
          break;
        }
      }

      // Set result to scope
      $scope.revision = delta;
      $scope.revisionModel = revisionModel;
      $scope.revisionHTML = $sce.trustAsHtml($scope.api.getHTML(revisionModel));
    };
  }]);
})();
