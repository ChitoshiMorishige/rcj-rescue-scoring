var app = angular.module("MailTemplates", ['ngTouch','pascalprecht.translate', 'ngCookies']);
app.controller("MailTemplatesController",['$scope', '$http', '$translate', function ($scope, $http, $translate) {
  
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000
  });

  let deleted_mes;
  $translate('admin.mailTemplates.js.deleted').then(function (val) {
    deleted_mes = val;
  }, function (translationId) {
  // = translationId;
  });

  updateTemplatesList()

  $scope.removeTemplate = async function (mail) {
    const {
        value: operation
    } = await swal({
        title: "Remove mail teamplate?",
        text: "Are you sure you want to remove the template: " +
          mail.name + '?',
        type: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, delete it!",
        confirmButtonColor: "#ec6c62",
        input: 'text',
        inputPlaceholder: 'Enter "DELETE" here',
        inputValidator: (value) => {
            return value != 'DELETE' && 'You need to type "DELETE" !'
        }
    })

    if (operation) {
      $http.delete("/api/mail/templates/" + mail.path).then(function (response) {
        console.log(response)
        updateTemplatesList()
        Toast.fire({
          type: 'success',
          title: deleted_mes
        })
      }, function (error) {
        console.log(error)
        Toast.fire({
            type: 'error',
            title: "Error: " + error.statusText,
            html: error.data.msg
        })
      })
    }
}
  
  function updateTemplatesList() {
    $http.get("/api/mail/templates").then(function (response) {
      console.log(response)
      $scope.mails = response.data
    })
  }
    
    $scope.go = function (path) {
        window.location = path
    }
}])