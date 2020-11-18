// register the directive with your app module
var app = angular.module('FormEditor', ['ngTouch','ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies']);

// function referenced by the drop target
app.controller('FormEditorController', ['$scope', '$uibModal', '$log', '$http', '$translate', function ($scope, $uibModal, $log, $http, $translate) {

    let i18n_update,i18n_update_mes,i18n_create,i18n_create_mes,i18n_sameName,i18n_sameName_mes;
    $translate('signage.editor.alert.update').then(function (val) {
        i18n_update = val;
    }, function (translationId) {
        // = translationId;
    });
    $translate('signage.editor.alert.update_mes').then(function (val) {
        i18n_update_mes = val;
    }, function (translationId) {
        // = translationId;
    });
    $translate('signage.editor.alert.create').then(function (val) {
        i18n_create = val;
    }, function (translationId) {
        // = translationId;
    });
    $translate('signage.editor.alert.create_mes').then(function (val) {
        i18n_create_mes = val;
    }, function (translationId) {
        // = translationId;
    });
    $translate('signage.editor.alert.sameName').then(function (val) {
        i18n_sameName = val;
    }, function (translationId) {
        // = translationId;
    });
    $translate('signage.editor.alert.sameName_mes').then(function (val) {
        i18n_sameName_mes = val;
    }, function (translationId) {
        // = translationId;
    });

    $http.get("/api/competitions/" + competitionId).then(function (response) {
        $scope.competition = response.data
    })

    $http.get("/api/competitions/leagues/"+leagueId).then(function (response) {
        $scope.league = response.data
    });

    
    $scope.addContents = function (number){
        var content = {
            duration : 0,
            type : "",
            url : "",
            group: "0",
            disable: false
        }
        $scope.contents.splice(number,0,content);
    }

    $scope.movieExist = function(url){

    }

    $scope.select = function (index){

        if($scope.contents[index].type === 'iframe'){
            return;
        }

        if($scope.contents[index].type === 'img'){
            $http.get("/api/signage/contentList/img").then(async function (response) {
                let list = response.data;
                let listSelect = {};
                for(let l of list){
                    listSelect[l] = l;
                }
                const { value: url } = await Swal.fire({
                    title: 'Select a image',
                    confirmButtonText: 'OK &rarr;',
                    input: 'select',
                    inputOptions: listSelect,
                    inputPlaceholder: 'Select a image',
                    showCancelButton: true,
                    inputValidator: (value) => {
                        return new Promise((resolve) => {
                            if (value) {
                                resolve()
                            } else {
                                resolve('You need to select a image')
                            }
                        })
                    }
                })
                if(url){
                    $scope.contents[index].url = "/signage_content/" + url;
                    $scope.$apply();
                }
            });
        }else if($scope.contents[index].type === 'movie'){
            $http.get("/api/signage/contentList/mov").then(async function (response) {
                let list = response.data;
                let listSelect = {};
                for(let l of list){
                    listSelect[l] = l;
                }
                const { value: url } = await Swal.fire({
                    title: 'Select a movie',
                    confirmButtonText: 'OK &rarr;',
                    input: 'select',
                    inputOptions: listSelect,
                    inputPlaceholder: 'Select a movie',
                    showCancelButton: true,
                    inputValidator: (value) => {
                        return new Promise((resolve) => {
                            if (value) {
                                resolve()
                            } else {
                                resolve('You need to select a movie')
                            }
                        })
                    }
                })
                if(url){
                    $scope.contents[index].url = "/signage_content/" + url;
                    $scope.$apply();
                }
            });
        }
    }

    $scope.addRanking = function (number,league){
        var content = {
            duration : -1,
            type : "iframe",
            url : "/signage/display/:competition/score/"+league,
            group: "0",
            disable: false
        }
        $scope.contents.splice(number,0,content);
    }

    $scope.addTimeTable = async function (number){
        let competitionSelect = {};
        for(let c of $scope.competitions){
            competitionSelect[c._id] = c.name;
        }
        const { value: competition } = await Swal.fire({
            title: 'Select a competition',
            confirmButtonText: 'Next &rarr;',
            input: 'select',
            inputOptions: competitionSelect,
            inputPlaceholder: 'Select a competition',
            showCancelButton: true,
            inputValidator: (value) => {
                return new Promise((resolve) => {
                    if (value) {
                        resolve()
                    } else {
                        resolve('You need to select a competition')
                    }
                })
            }
        })
        if(!competition) return;

        let sleagues = [];
        $http.get("/api/teams/leagues/line/" + competition).then(function (response) {
            sleagues = response.data
            $http.get("/api/teams/leagues/maze/" + competition).then(async function (response) {
                sleagues = sleagues.concat(response.data);
                console.log(sleagues);
                let leagueSelect = {};
                for(let l of sleagues){
                    leagueSelect[l.id] = l.name;
                }
                const { value: leagueId } = await Swal.fire({
                    title: 'Select a league',
                    confirmButtonText: 'Next &rarr;',
                    input: 'select',
                    inputOptions: leagueSelect,
                    inputPlaceholder: 'Select a league',
                    showCancelButton: true,
                    inputValidator: (value) => {
                        return new Promise((resolve) => {
                            if (value) {
                                resolve()
                            } else {
                                resolve('You need to select a league')
                            }
                        })
                    }
                })
                if(!leagueId) return;
                $http.get("/api/competitions/"+ competition +"/" + leagueId + "/rounds").then(async function (response) {
                    let rounds = response.data
                    let roundSelect = {};
                    for(let r of rounds){
                        roundSelect[r._id] = r.name;
                    }
                    const { value: round } = await Swal.fire({
                        title: 'Select a round',
                        input: 'select',
                        inputOptions: roundSelect,
                        inputPlaceholder: 'Select a round',
                        showCancelButton: true,
                        inputValidator: (value) => {
                            return new Promise((resolve) => {
                                if (value) {
                                    resolve()
                                } else {
                                    resolve('You need to select a round')
                                }
                            })
                        }
                    })
                    if(!round) return;
                    let content = {
                        duration : -1,
                        type : "iframe",
                        url : "/signage/display/" + competition+ "/timetable/" + leagueId +"/" + round,
                        group: "0",
                        disable: false
                    }
                    $scope.contents.splice(number,0,content);
                    $scope.$apply();
                })


            });

        })

    }
    
    $scope.removeContents = function (number){
        $scope.contents.splice(number,1);
    }
    
    $scope.addNews = function (number){
        var news = {
            txt: ""
        }
        $scope.news.splice(number,0,news);
    }
    
    $scope.removeNews = function (number){
        $scope.news.splice(number,1);
    }
    
    $scope.go = function (path) {
        window.location = path
    }

    $scope.iframeUrl = function (url){
        if($scope.competitions && $scope.competitions[0]){
            url = url.replace(':competition',$scope.competitions[0]._id);
        }
        console.log(url);
        return url;
    }

    $scope.durationShow = function (content){
        if(content.type == "movie"){
            content.duration = 0;
            return false;
        }
        if (content.url.match(/\/signage\/display\/:competition\/score/)) {
            content.duration = -1;
            return false;
        }
        if (content.url.match(/timetable/)) {
            content.duration = -1;
            return false;
        }
        return true;
    }
    


    $scope.saveAs = function () {
        if ($scope.name == original_name) {
            Swal.fire(
              i18n_sameName,
              i18n_sameName_mes,
              'error'
            )
            return;
        }
        var signage = {
            name: $scope.name,
            content : $scope.contents,
            news : saveNews()
        };
        $http.post("/api/signage", signage).then(function (response) {
            Swal.fire(
              i18n_create,
              i18n_create_mes,
              'success'
            )
            console.log(response.data);
            window.location.replace("/signage/setting/editor/" + response.data.id)
        }, function (response) {
            console.log(response);
            console.log("Error: " + response.statusText);
            alert(response.data.msg);
        });
        
    }
    
    function saveNews(){
        var ret=[]
        for(let i in $scope.news){
            ret.push($scope.news[i].txt);
        }
        return ret;
    }
    
    $scope.save = function () {
    }

}]);



