var app = angular.module("MailSent", ['ngTouch','ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies']);
app.controller('MailSentController', ['$scope', '$uibModal', '$log', '$http', '$translate', '$sce', function ($scope, $uibModal, $log, $http, $translate, $sce) {

    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
    });

    $scope.trust = function(html){
        return($sce.trustAsHtml(html));
    }

    $scope.competitionId = competitionId;

    $http.get("/api/competitions/" + competitionId).then(function (response) {
        $scope.competition = response.data
    })

    $scope.Rleagues = {};
    $scope.leagueName = [];
    $http.get("/api/competitions/leagues").then(function (response) {
        $scope.leagues = response.data;
        
        for(let l of $scope.leagues){
            $scope.Rleagues[l.id] = false;
            $scope.leagueName[l.id] = l.name;
        }
    })


    $http.get("/api/mail/sent/" + competitionId).then(function (response) {
        $scope.mails = response.data;
        console.log($scope.mails);
    })


    $scope.go = function (path) {
        window.location = path
    }

    $scope.time = function(time){
        let options = {year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric"};
        return(new Intl.DateTimeFormat(navigator.language, options).format(time*1000));
    }

    $scope.mailView = function(mail){
        let mailUrl = `/api/mail/sent/${mail.competition}/${mail.mailId}`;
        $http.get(mailUrl).then(function (response) {
            let html = response.data.html.replace(/<img[^>]+>/, "");
            let plain = response.data.plain.replace(/\r?\n/g, '<br>');
            Swal.fire({
                html:'<ul class="nav nav-tabs" id="mailType" role="tablist"><li class="nav-item"><a class="nav-link active" id="html-tab" data-toggle="tab" href="#html" role="tab" aria-controls="html" aria-selected="true">HTML</a></li><li class="nav-item"><a class="nav-link" id="plain-tab" data-toggle="tab" href="#plain" role="tab" aria-controls="plain" aria-selected="false">Plain Text</a></li></ul>'+
                '<div class="tab-content" id="mailTypeContent">'+
                    '<div class="tab-pane fade show active" id="html" role="tabpanel" aria-labelledby="html-tab" style="text-align:left;max-height:calc(100vh - 200px);overflow:auto;">' + html +'</div>'+
                    '<div class="tab-pane fade" id="plain" role="tabpanel" aria-labelledby="plain-tab" style="text-align:left;max-height:calc(100vh - 200px);overflow:auto;">' + plain + '</div>'+
                '</div>',
                width: "100%",
                height: "100%",
                showCloseButton: true, 
            })
        }, function (response) {
            Toast.fire({
                type: 'error',
                title: "Error: " + response.statusText,
                html: response.data.msg
            })
        })
        
    }

    $scope.statusColour = function(status){
        switch(status){
            case 1:
              return "#ffffcc";
            case 2:
              return "#ccffe5";
            default:
              return "";
          }
    }

    $scope.detail = function(mail){
        let mailUrl = `/api/mail/event/${mail.competition}/${mail.mailId}`;
        let html = `<div style="max-height:calc(100vh - 200px);overflow:auto;">`;
        html += `<h3>配信先</h3><table class='custom'><thead><tr><th>メール</th></tr></thead><tbody>`;
        for(let m of mail.to){
            html += `<tr><td>${m}</td></tr>`;
        }
        html += "</tbody></table><br>";
        $http.get(mailUrl).then(function (response) {
            html += `<h3>イベントログ</h3><table class='custom'><thead><tr><th>時刻</th><th>ユーザ</th><th>メッセージ</th></tr></thead><tbody>`;
            for(let e of response.data){
                html += `<tr><td>${$scope.time(e.time)}</td><td>${e.user}</td><td>${e.event}</td></tr>`;
            }
                
            html += "</tbody></table></div>";
            Swal.fire({
                html: html,
                width: "100%",
                height: "100%",
                showCloseButton: true, 
            })
        }, function (response) {
            Toast.fire({
                type: 'error',
                title: "Error: " + response.statusText,
                html: response.data.msg
            })
        })
        
    }

    var showAllLeagues = true;
    $scope.refineName = "";
    $scope.refineCode = "";
    $scope.refineRegion = "";

    $scope.$watch('Rleagues', function (newValue, oldValue) {
        showAllLeagues = true
        //console.log(newValue)
        for (let league in newValue) {
            if (newValue.hasOwnProperty(league)) {
                if (newValue[league]) {
                    showAllLeagues = false
                    return
                }
            }
        }
    }, true);

    $scope.list_filter = function (value, index, array) {
        return (showAllLeagues || $scope.Rleagues[value.league])  && (~value.team.name.indexOf($scope.refineName)) && (~value.team.teamCode.indexOf($scope.refineCode)) && (~value.team.country.indexOf($scope.refineRegion))
    }

}]);

