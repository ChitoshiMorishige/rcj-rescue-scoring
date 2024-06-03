var app = angular.module("MailHome", ['ngTouch','ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies', 'ngQuill']);
app.controller('MailHomeController', ['$scope', '$uibModal', '$log', '$http', '$translate', '$sce', function ($scope, $uibModal, $log, $http, $translate, $sce) {

    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
    });
      
    let saved_mes;
    $translate('document.saved').then(function (val) {
        saved_mes = val;
    }, function (translationId) {
    // = translationId;
    });

    let sending_mes;
    $translate('mail.home.js.sending').then(function (val) {
        sending_mes = val;
    }, function (translationId) {
    // = translationId;
    });

    let wait_mes;
    $translate('mail.home.js.wait').then(function (val) {
        wait_mes = val;
    }, function (translationId) {
    // = translationId;
    });

    let complete_mes;
    $translate('mail.home.js.complete').then(function (val) {
        complete_mes = val;
    }, function (translationId) {
    // = translationId;
    });

    let completeMes_mes;
    $translate('mail.home.js.completeMes').then(function (val) {
        completeMes_mes = val;
    }, function (translationId) {
    // = translationId;
    });

    $scope.trust = function(html){
        return($sce.trustAsHtml(html));
    }

    $scope.competitionId = competitionId;

    $scope.mode = "select";

    $http.get("/api/competitions/" + competitionId).then(function (response) {
        $scope.competition = response.data
        console.log($scope.competition)
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


    $http.get("/api/competitions/" + competitionId + "/adminTeams").then(function (response) {
        $scope.teams = response.data;

        $scope.showCode = false;
        for(let t of $scope.teams){
            if(t.teamCode != ""){
                $scope.showCode = true;
                break;
            }
        }
    })


    $scope.selectedTemplate = null;
    $http.get("/api/mail/templates").then(function (response) {
        $scope.templates = response.data
    })

    $scope.changeTemplate = function(){
        if(!$scope.selectedTemplate) return;
        $http.get(`/api/mail/templates/${$scope.selectedTemplate}`).then(function (response) {
            $scope.mailContent = response.data;
            $scope.mailTitle = $scope.selectedTemplate.replace(".html","");
        })
    }

    $scope.go = function (path) {
        window.location = path
    }

    $scope.open = function (path){
        window.open(path, "_blank");
    }

    $scope.selectedAll = false;
    $scope.selectAll = function () {
        if($scope.selectedAll){
            angular.forEach($scope.teams, function (team) {
                team.checked = false;
            });
            $scope.selectedAll = false;
        }else{
            angular.forEach($scope.teams, function (team) {
                if($scope.list_filter(team) && $scope.validEmail(team.email)){
                    team.checked = true;
                    $scope.selectedAll = true;
                }
            });
        }
        
    }

    $scope.newEmail2SelectedTeam = function () {
        let chk = [];
        angular.forEach($scope.teams, function (team) {
            if (team.checked) chk.push(team);
        });
        $scope.toTeam = chk;
        prepareVariable();
    }

    function prepareVariable(){
        for(let i=0; i<$scope.toTeam.length; i++){
            let teamDeadline = $scope.toTeam[i].document.deadline;
            let deadline = $scope.competition.documents.deadline;
            if(teamDeadline != null) deadline = teamDeadline;

            let d = new Date(deadline * 1000);
            let options = { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",timeZoneName:"long" };
            let optionsUTC = { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",timeZoneName:"long", timeZone:"UTC"};
            $scope.toTeam[i].variable = {
                "teamName": $scope.toTeam[i].name,
                "teamId": $scope.toTeam[i]._id,
                "competitionName": $scope.competition.name,
                "competitionId": $scope.competition._id,
                "leagueId": $scope.toTeam[i].league,
                "league": $scope.leagueName[$scope.toTeam[i].league],
                "deadlineUNIX": deadline,
                "deadlineLocal": new Intl.DateTimeFormat(navigator.language, options).format(d),
                "deadlineUTC": new Intl.DateTimeFormat('en-US', optionsUTC).format(d),
                "documentUrl": `${location.protocol}//${location.host}/document/${$scope.toTeam[i]._id}/${$scope.toTeam[i].document.token}`,
                "mypageUrl": `${location.protocol}//${location.host}/mypage/${$scope.toTeam[i]._id}/${$scope.toTeam[i].document.token}`
            };
        }
        $scope.mode = "write";
        window.scrollTo(0,0);
    }

    $scope.validEmail = function(mail){
        function MailCheck(mail) {
            var mail_regex1 = new RegExp( '(?:[-!#-\'*+/-9=?A-Z^-~]+\.?(?:\.[-!#-\'*+/-9=?A-Z^-~]+)*|"(?:[!#-\[\]-~]|\\\\[\x09 -~])*")@[-!#-\'*+/-9=?A-Z^-~]+(?:\.[-!#-\'*+/-9=?A-Z^-~]+)*' );
            var mail_regex2 = new RegExp( '^[^\@]+\@[^\@]+$' );
            if( mail.match( mail_regex1 ) && mail.match( mail_regex2 ) ) {
                if( mail.match( /[^a-zA-Z0-9\!\"\#\$\%\&\'\(\)\=\~\|\-\^\\\@\[\;\:\]\,\.\/\\\<\>\?\_\`\{\+\*\} ]/ ) ) { return false; }
                if( !mail.match( /\.[a-z]+$/ ) ) { return false; }
                return true;
            } else {
                return false;
            }
        }
        if(!mail || mail.length == 0) return false;
        for(let m of mail){
            if(MailCheck(m)) return true;
        }
    }

    $scope.newMail = function(team){
        $scope.toTeam = [team];
        prepareVariable();
        
    }

    $scope.back2TeamSelect = function(){
        $scope.toTeam = [];
        $scope.mode = "select";
        window.scrollTo(0,0);
    }

    $scope.mailContent = "";
    $scope.mailTitle = "";

    function template(string, values){
        return string.replace(/\$\{(.*?)\}/g, function(all, key){
            return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : "";
        });
    }

    $scope.previewNo = 0;
    $scope.preview = function(){
        console.log($scope.mailContent);
        for(let team of $scope.toTeam){
            team.mailData = {
                "title": template($scope.mailTitle, team.variable),
                "content": template($scope.mailContent, team.variable).replace(/<p><br><\/p>/g,"<br>").replace(/<\/p><p>/g,"<br>")
            }
        }
        $scope.mode = "preview";
        window.scrollTo(0,0);
    }

    $scope.changePreviewNo = function(n){
        $scope.previewNo += n;
    }

    $scope.back2Edit = function(){
        $scope.mode = "write";
        window.scrollTo(0,0);
    }

    $scope.showVariable = function(variable){
        let html = `<div style="max-height:calc(100vh - 200px);overflow:auto;"><table class='custom'><thead><tr><th>変数名</th><th>内容</th></tr></thead><tbody>`;
        Object.keys(variable).forEach((key) => {
            html += `<tr><td>\${${key}}</td><td>${variable[key]}</td></tr>`;
        })
        html += "</tbody></table></div>";

        Swal.fire({
            title: 'Variables',
            html: html,
            width: "100%",
            height: "100%",
            showCloseButton: true, 
        })
    }

    $scope.time = function(time){
        let options = {year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric"};
        return(new Intl.DateTimeFormat(navigator.language, options).format(time));
    }

    $scope.sending = false;
    $scope.mailSend = function(){
        $scope.sending = true;
        Swal({
            title: sending_mes,
            html: wait_mes,
            onBeforeOpen: () => {
                Swal.showLoading()
                $http.post(`/api/mail/send`, {data: $scope.toTeam, reservation: $scope.reservation}).then(function (response) {
                    Swal.close()
                    Swal({
                        type: 'success',
                        title: complete_mes,
                        html: completeMes_mes
                    })
                    $scope.toTeam = [];
                    $scope.mailContent = "";
                    $scope.mailTitle = "";
                    $scope.previewNo = 0;
                    $scope.mode = "select";
                    $scope.selectedTemplate = null;
                    $scope.sending = false;
                    $scope.reservation = undefined;
                    
                }, function (error) {
                    console.log(error)
                    Swal.close()
                    $scope.sending = false;
                    Swal({
                        type: 'error',
                        title: "ERROR",
                        html: error.data.msg
                    })
                })
            }
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
        return (showAllLeagues || $scope.Rleagues[value.league])  && (~value.name.indexOf($scope.refineName)) && (~value.teamCode.indexOf($scope.refineCode)) && (~value.country.indexOf($scope.refineRegion))
    }

    $scope.quillHeight = function (editor) {
        editor.container.style.height = '500px';
    };
}]);

app.constant('NG_QUILL_CONFIG', {
    /*
     * @NOTE: this config/output is not localizable.
     */
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
        ['blockquote', 'code-block'],
  
        [{ 'header': 1 }, { 'header': 2 }],               // custom button values
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        [{ 'script': 'sub' }, { 'script': 'super' }],     // superscript/subscript
        [{ 'indent': '-1' }, { 'indent': '+1' }],         // outdent/indent
        [{ 'direction': 'rtl' }],                         // text direction
  
        [{ 'size': ['small', false, 'large', 'huge'] }],  // custom dropdown
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
  
        [{ 'color': [] }, { 'background': [] }],          // dropdown with defaults from theme
        [{ 'font': [] }],
        [{ 'align': [] }],
  
        ['clean'],                                         // remove formatting button
  
        ['link', 'image', 'video']                         // link and image, video
      ],
      imageResize: {
      },
      imageDropAndPaste: {
      }
    },
    theme: 'snow',
    debug: 'warn',
    placeholder: '',
    readOnly: false,
    bounds: document.body,
    scrollContainer: null
})
  
app.config([
    'ngQuillConfigProvider',
    'NG_QUILL_CONFIG',

    function (ngQuillConfigProvider, NG_QUILL_CONFIG) {
        ngQuillConfigProvider.set(NG_QUILL_CONFIG)
    }
])
