/*********************************************************************************/
// This file is a RoboCup Junior Rescue 2019 rule correspondence version. //
/*********************************************************************************/

// register the directive with your app module

var app = angular.module('ddApp', ['ngTouch', 'ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies']);
var marker = {};


// function referenced by the drop target
app.controller('ddController', ['$scope', '$uibModal', '$log', '$timeout', '$http', '$translate', '$cookies', function ($scope, $uibModal, $log, $timeout, $http, $translate, $cookies) {
    $scope.runId = runId;

    $scope.lastModifiedIndex = 0;
    $scope.z = 0;
    $scope.startedTime = false;
    $scope.time = 0;
    $scope.startUnixTime = 0;


    $scope.victim_list = [];
    $scope.victim_tmp = [];
    $scope.LoPs = [];


    const http_config = {
        timeout: 10000
    };

    var tileReset = true;

    var date = new Date();
    var prevTime = 0;
    var tileReset = true;



    // Scoring elements of the tiles
    $scope.stiles = [];
    // Map (images etc.) for the tiles
    $scope.mtiles = [];


    function loadNewRun() {
        $http.get("/api/runs/line/" + runId +
            "?populate=true").then(function (response) {

            $scope.LoPs = response.data.LoPs;
            $scope.evacuationLevel = response.data.evacuationLevel;
            $scope.kitLevel = response.data.kitLevel;
            $scope.exitBonus = response.data.exitBonus;
            $scope.field = response.data.field.name;
            $scope.score = response.data.score;
            $scope.raw_score = response.data.raw_score;
            $scope.multiplier = response.data.multiplier;
            $scope.showedUp = response.data.showedUp;
            $scope.started = response.data.started;
            $scope.round = response.data.round.name;
            $scope.team = response.data.team;
            $scope.league = response.data.team.league;
            $scope.competition = response.data.competition;
            // Verified time by timekeeper
            $scope.minutes = response.data.time.minutes;
            $scope.seconds = response.data.time.seconds;
            $scope.time = ($scope.minutes * 60 + $scope.seconds) * 1000;
            $scope.status = response.data.status;
            if($scope.status > 2) $scope.lastModifiedIndex = 100;


            prevTime = $scope.time;

            var started = response.data.started;

            $scope.victim_list = response.data.rescueOrder;


            // Scoring elements of the tiles
            $scope.stiles = response.data.tiles;
            $scope.actualUsedDropTiles = 0;
            for (var i = 0; i < response.data.tiles.length; i++) {
                if (response.data.tiles[i].isDropTile) {
                    $scope.actualUsedDropTiles++;
                    marker[i] = true;
                }
            }


            // Get the map
            $http.get("/api/maps/line/" + response.data.map +
              "?populate=true").then(function (response) {
                console.log(response);
                $scope.height = response.data.height;

                $scope.width = response.data.width;
                $scope.length = response.data.length;
                width = response.data.width;
                length = response.data.length;
                $scope.startTile = response.data.startTile;
                //$scope.numberOfDropTiles = response.data.numberOfDropTiles;
                $scope.mtiles = {};

                // Get max victim count
                $scope.maxLiveVictims = response.data.victims.live;
                $scope.maxDeadVictims = response.data.victims.dead;

                $scope.mapIndexCount = response.data.indexCount;
                $scope.EvacuationAreaLoPIndex = response.data.EvacuationAreaLoPIndex;


                var flag = false;
                var sItem = {
                    item: "",
                    scored: false
                };
                var ntile = {
                    scoredItems: [],
                    isDropTile: false
                };

                console.log(started);

                if (!started && tileReset && $scope.status == 0) {
                    $scope.stiles = [];
                    tileReset = false;
                    console.log("AAAAAAAA")
                }

                if ($scope.stiles.length < response.data.indexCount) {
                    $scope.actualUsedDropTiles = 0;
                    while ($scope.stiles.length < response.data.indexCount) {
                        $scope.stiles.push({
                            scoredItems: [],
                            isDropTile: false
                        });
                        flag = true;
                        console.log("BBBBBB");
                    }
                    //console.log($scope.stiles);
                    //var noCheck = [];
                    for (let i = 0, t; t = response.data.tiles[i]; i++) {
                        for (let j = 0; j < t.index.length; j++) {
                            //console.log(t.items.obstacles);
                            for (let k = 0; k < t.items.obstacles; k++) {
                                let addSItem = {
                                    item: "obstacle",
                                    scored: false
                                };
                                $scope.stiles[t.index[j]].scoredItems.push(addSItem);
                            }

                            for (let k = 0; k < t.items.speedbumps; k++) {
                                let addSItem = {
                                    item: "speedbump",
                                    scored: false
                                };
                                $scope.stiles[t.index[j]].scoredItems.push(addSItem);
                            }


                            for (let k = 0; k < t.tileType.gaps; k++) {
                                let addSItem = {
                                    item: "gap",
                                    scored: false
                                };
                                $scope.stiles[t.index[j]].scoredItems.push(addSItem);
                            }

                            if (t.tileType.intersections > 0) {
                                let addSItem = {
                                    item: "intersection",
                                    scored: false,
                                    count: t.tileType.intersections
                                };
                                $scope.stiles[t.index[j]].scoredItems.push(addSItem);
                            }

                            for (let k = 0; k < t.tileType.seesaw; k++) {
                                let addSItem = {
                                    item: "seesaw",
                                    scored: false
                                };
                                $scope.stiles[t.index[j]].scoredItems.push(addSItem);
                            }

                            if (t.items.rampPoints) {
                                let addSItem = {
                                    item: "ramp",
                                    scored: false
                                };
                                $scope.stiles[t.index[j]].scoredItems.push(addSItem);
                            }

                            if (t.checkPoint){
                                let addSItem = {
                                    item: "checkpoint",
                                    scored: false
                                };
                                $scope.stiles[t.index[j]].scoredItems.push(addSItem);
                                $scope.stiles[t.index[j]].isDropTile = true;
                                marker[t.index[j]] = true;
                                $scope.actualUsedDropTiles++;
                            }
                        }
                    }

                }

                console.log($scope.stiles);

                if (flag) {
                    $scope.sync++;
                    $http.put("/api/runs/line/" + runId, {
                        tiles: $scope.stiles
                    }, http_config).then(function (response) {
                        console.log("Run Score Tileset Updated");
                        loadNewRun();
                        $scope.sync--;
                    }, function (response) {
                        console.log("Error: " + response.statusText);
                        if (response.status == 401) {
                            $scope.go('/home/access_denied');
                        }
                        $scope.networkError = true;
                    });
                    return;
                }

                db_mtile = response.data.tiles;
                for (var i = 0; i < response.data.tiles.length; i++) {
                    $scope.mtiles[response.data.tiles[i].x + ',' +
                    response.data.tiles[i].y + ',' +
                    response.data.tiles[i].z] = response.data.tiles[i];

                    if ($scope.stiles[response.data.tiles[i].index[0]] &&
                      $scope.stiles[response.data.tiles[i].index[0]].isDropTile) {
                        $scope.placedDropTiles++;
                    }
                }
                console.log($scope.mtiles)

                // Calculate score sheets layout [Simuate]
                let index = 0;
                let x = 440;
                let y = 35;
                let x2 = 440;
                let y2 = 35;
                let base_size_x = 95;
                let base_size_y = 36;
                let base_size_x2 = 76;
                let base_size_y2 = 29;

                let el1 = [];
                let elow1 = 0;
                let el2 = [];
                let elow2 = 0;

                let lopIndex = 0;

                y+=base_size_y; // Start tile
                y2+=base_size_y2;
                let tmp = {
                    index : 0,
                    start: true
                }
                if(!el1[elow1]) el1[elow1] = [];
                el1[elow1].push(tmp);
                if(!el2[elow2]) el2[elow2] = [];
                el2[elow2].push(tmp);


                for(let tile of $scope.stiles){
                    if(tile.scoredItems.length == 0){
                        index++;
                        continue;
                    }
                    if(tile.scoredItems[0].item == "checkpoint"){
                        if(y>330-base_size_y*2){
                            x += base_size_x;
                            y = 35;
                            elow1 ++;
                        }
                        if(y2>330-base_size_y2*2){
                            x2 += base_size_x2;
                            y2 = 35;
                            elow2 ++;
                        }
                        tile.index = index;
                        tile.LoP = lopIndex;
                        if(!$scope.LoPs[lopIndex]) $scope.LoPs[lopIndex] = 0;
                        if(lopIndex == $scope.EvacuationAreaLoPIndex) tile.evacLoP = true;
                        lopIndex++;
                        if(!el1[elow1]) el1[elow1] = [];
                        el1[elow1].push(tile);
                        if(!el2[elow2]) el2[elow2] = [];
                        el2[elow2].push(tile);

                        y+=base_size_y*2;
                        y2+=base_size_y2*2;
                        if(y>330-base_size_y){
                            x += base_size_x;
                            y = 35;
                            elow1 ++;
                        }
                        if(y2>330-base_size_y2){
                            x2 += base_size_x2;
                            y2 = 35;
                            elow2 ++;
                        }

                    }else{
                        tile.index = index;
                        if(!el1[elow1]) el1[elow1] = [];
                        el1[elow1].push(tile);
                        if(!el2[elow2]) el2[elow2] = [];
                        el2[elow2].push(tile);

                        y+=base_size_y;
                        y2+=base_size_y2;
                        if(y>330-base_size_y){
                            x += base_size_x;
                            y = 35;
                            elow1 ++;
                        }
                        if(y2>330-base_size_y2){
                            x2 += base_size_x2;
                            y2 = 35;
                            elow2 ++;
                        }
                    }

                    index++;
                }

                tmp = {
                    index : index,
                    afterLoP: true,
                    LoP: lopIndex
                }
                if(!$scope.LoPs[lopIndex]) $scope.LoPs[lopIndex] = 0;
                if(!el1[elow1]) el1[elow1] = [];
                el1[elow1].push(tmp);
                if(!el2[elow2]) el2[elow2] = [];
                el2[elow2].push(tmp);

                console.log(elow1);
                console.log(elow2);
                console.log(el1);
                console.log(el2);

                if(el1.length <= 4) $scope.elementList = el1;
                else $scope.elementList = el2;

                console.log($scope.elementList)


            }, function (response) {
                console.log("Error: " + response.statusText);
            });


        }, function (response) {
            console.log("Error: " + response.statusText);
            if (response.status == 401) {
                $scope.go('/home/access_denied');
            }
        });
    }




    loadNewRun();


    $scope.numberStyle = function(item){
        if(item.evacLoP) return {color: '#FA4261',backgroundColor: '#FFC4CE'};
        if(item.isDropTile || item.start) return {color: 'orange',backgroundColor: '#FFE7D2'};
        return {color: '#42C8FA'};
    }

    $scope.itemChange = function(item){
        playSound(sClick);

        if(item.start){
            $scope.showedUp = !$scope.showedUp;
            if($scope.lastModifiedIndex < item.index) $scope.lastModifiedIndex = item.index;
            changerAfterAll(item,$scope.showedUp);
            return;
        }

        let status = !item.scoredItems[0].scored;
        for(let i of item.scoredItems){
            i.scored = status;
        }
        if($scope.lastModifiedIndex < item.index) $scope.lastModifiedIndex = item.index;
        changerAfterAll(item,status);
        console.log($scope.stiles);
    }

    function changerAfterAll(item,status){
        if($scope.lastModifiedIndex > item.index) return;
        let flag = false;
        for(let list of $scope.elementList){
            for(let l of list){
                if(flag && l.scoredItems){
                    for(let i of l.scoredItems){
                        i.scored = status;
                    }
                }

                if(l.index == item.index) flag = true;
            }
        }
    }

    $scope.itemSuccess = function(item){
        if(item.start) return $scope.showedUp;
        if(item.scoredItems[0].scored) return true;
        return false;
    }

    $scope.range = function (n) {
        arr = [];
        for (var i = 0; i < n; i++) {
            arr.push(i);
        }
        return arr;
    }



    $scope.count_victim_list = function (type) {
        let count = 0
        for (victiml of $scope.victim_list) {
            if (!victiml.type.indexOf(type)) {
                count++;
            }
        }
        return count;
    }

    $scope.count_victim_tmp = function (type) {
        let count = 0
        for (victiml of $scope.victim_tmp) {
            if (!victiml.indexOf(type)) {
                count++;
            }
        }
        return count;
    }

    $scope.addVictimTmp = function (type) {
        playSound(sClick);
        if (type == "L") {
            if ($scope.count_victim_list("L") + $scope.count_victim_tmp("L") >= $scope.maxLiveVictims) return;
        } else if(type == "D") {
            if ($scope.count_victim_list("D") + $scope.count_victim_tmp("D") >= $scope.maxDeadVictims) return;
        } else{ //Rescue Kit
            if ($scope.count_victim_list("K") + $scope.count_victim_tmp("K") >= 1) return;
        }
        $scope.victim_tmp.push(type);
        $scope.victimRegist();
    };

    $scope.addVictim = function (type) {
        let tmp = {};
        tmp.effective = true;
        if (type == "L") {
            tmp.type = "L";
            if ($scope.count_victim_list("L") >= $scope.maxLiveVictims) return;
        } else if(type == "D") {
            tmp.type = "D";
            if ($scope.count_victim_list("D") >= $scope.maxDeadVictims) return;
            if ($scope.count_victim_list("L") >= 1) { // At least one live victim rescued

            } else {
                tmp.effective = false;
            }
        }else{ //Rescue Kit
            tmp.type = "K";
            if ($scope.count_victim_list("K") >= 1) return;
        }


        $scope.victim_list.push(tmp);
    };

    function reStateVictim() {
        let count = 0;
        for (victiml of $scope.victim_list) {
            if (!victiml.type.indexOf("L")) {
                count++;
            }
            if (!victiml.type.indexOf("D")) {
                if (count >= 1) {
                    victiml.effective = true;
                } else {
                    victiml.effective = false;
                }
            }

        }
    }

    $scope.delete_victim = function (index) {
        playSound(sClick);
        $scope.victim_list.splice(index, 1);
        reStateVictim();

    };

    $scope.victimRegist = function () {
        let live = 0;
        let dead = 0;
        let kit = 0;
        for (victiml of $scope.victim_tmp) {
            if (!victiml.indexOf("L")) {
                live++;
            } else if (!victiml.indexOf("D")) {
                dead++;
            } else{
                kit ++;
            }
        }
        for (let i = 0; i < live; i++) {
            $scope.addVictim("L");
        }
        for (let i = 0; i < dead; i++) {
            $scope.addVictim("D");
        }

        if(kit) $scope.addVictim("K");

        $scope.victim_tmp_clear();
    };

    $scope.victim_tmp_clear = function () {
        playSound(sClick);
        $scope.victim_tmp = [];
    }

    $scope.changeLevel = function (n) {
        playSound(sClick);
        $scope.evacuationLevel = n;
    }

    $scope.changeLevelK = function (n) {
        playSound(sClick);
        $scope.kitLevel = n;
    };


    $scope.send = function () {
            playSound(sClick);
            var run = {}
            run.LoPs = $scope.LoPs;
            run.evacuationLevel = $scope.evacuationLevel;
            run.kitLevel = $scope.kitLevel;
            run.exitBonus = $scope.exitBonus;
            run.rescueOrder = $scope.victim_list;
            run.showedUp = true;
            run.started = true;

            run.tiles = $scope.stiles;
            run.retired = false;
            run.time = {
                minutes: $scope.minutes,
                seconds: $scope.seconds
            };
            run.status = 4;


            $http.put("/api/runs/line/" + runId, run, http_config).then(function (response) {
                $scope.go($scope.getParam('return'));
            }, function (response) {
                console.log("Error: " + response.statusText);
                playSound(sError);
                Swal.fire(
                  'Error',
                  response.statusText,
                  'error'
                );
            });
    };

    $scope.approval = function () {
        playSound(sClick);
        var run = {}

        run.status = 6;

        $http.put("/api/runs/line/" + runId, run, http_config).then(function (response) {
            $scope.go($scope.getParam('return'));
        }, function (response) {
            console.log("Error: " + response.statusText);
            playSound(sError);
            Swal.fire(
              'Error',
              response.statusText,
              'error'
            );
        });
    };

    $scope.cancel = function(){
        $scope.go($scope.getParam('return'));
    }

    $scope.changeExitBonus = function () {
        playSound(sClick);
        $scope.exitBonus = !$scope.exitBonus
    }

    $scope.getParam = function (key) {
        var str = location.search.split("?");
        if (str.length < 2) {
            return "";
        }

        var params = str[1].split("&");
        for (var i = 0; i < params.length; i++) {
            var keyVal = params[i].split("=");
            if (keyVal[0] == key && keyVal.length == 2) {
                return decodeURIComponent(keyVal[1]);
            }
        }
        return "";
    }

    $scope.go = function (path) {
        playSound(sClick);
        window.location = path
    }


    function undefined2false(tmp){
        if(tmp) return true;
        return false;
    }

    var saveContent = [];
    $scope.focused = function (name,i) {
        if(i || i == 0){
            if(!saveContent[name]) saveContent[name] = [];
            saveContent[name][i] = $scope[name][i];
            $scope[name][i] = null;
        }else {
            if($scope[name] >= 0) {
                saveContent[name] = $scope[name];
                $scope[name] = "";
            }
        }
       fEnterChangeTab();
    };

    $scope.blured = function (name,i,flag) {

        if(i || i == 0){
            if($scope[name][i] == null){
                $scope[name][i] = saveContent[name][i];
                if($scope[name][i] == null && flag) {
                    $scope[name].splice(i, 1);
                    moveFocusNumber((i-1)*2+4);
                }
            }else if($scope[name][i] == 0 && flag){
                $scope[name].splice(i, 1);
            }
        }else{
            if($scope[name] == ""){
                if(typeof($scope[name]) == 'number'){
                    console.log("NUMBER");
                }else{
                    $scope[name] = saveContent[name];
                }
            }
        }
        fEnterChangeTab();
    };

    $scope.arriveMark = function (i) {
        if($scope.arrive[i] == null) return saveContent['arrive'][i];
        return $scope.arrive[i];
    }

}]);

function moveFocusNumber(num){
    var oObject = "#inputcontent :input:not(:button):not(:hidden)";
    cNext = ":eq(" + num + ")";
    $(oObject + cNext).focus();
}

function fEnterChangeTab(){
    var oObject = "#inputcontent :input:not(:button):not(:hidden)";
    $(oObject).off("keypress");
    $(oObject).keypress(function(e) {
        var c = e.which ? e.which : e.keyCode;
        if (c == 13) {
            var index = $(oObject).index(this);
            var cNext = "";
            var nLength = $(oObject).length;
            for(i=index;i<nLength;i++){
                cNext = e.shiftKey ? ":lt(" + index + "):last" : ":gt(" + index + "):first";
                if ($(oObject + cNext).attr("readonly") == "readonly") {
                    if (e.shiftKey) index--;
                    else index++;
                }
                else if ($(oObject + cNext).prop("disabled") == true) {
                    if (e.shiftKey) index--;
                    else index++;
                }
                else break;
            }
            if (index == nLength - 1) {
                if (! e.shiftKey){
                    cNext = ":eq(1)";
                }
            }
            if (index == 0) {
                if (e.shiftKey) {
                    cNext = ":eq(" + (nLength - 1) + ")";
                }
            }
            $(oObject + cNext).focus();
            e.preventDefault();
        }
    });
}

if(window.attachEvent){
    window.attachEvent('onload',fEnterChangeTab);
}
else if (window.opera){
    window.addEventListener('load',fEnterChangeTab,false);
}
else {
    window.addEventListener('load',fEnterChangeTab,false);
}

let lastTouch = 0;
document.addEventListener('touchend', event => {
    const now = window.performance.now();
    if (now - lastTouch <= 500) {
        event.preventDefault();
    }
    lastTouch = now;
}, true);



window.AudioContext = window.AudioContext || window.webkitAudioContext;
var context = new AudioContext();

var getAudioBuffer = function (url, fn) {
    var req = new XMLHttpRequest();
    req.responseType = 'arraybuffer';

    req.onreadystatechange = function () {
        if (req.readyState === 4) {
            if (req.status === 0 || req.status === 200) {
                context.decodeAudioData(req.response, function (buffer) {
                    fn(buffer);
                });
            }
        }
    };

    req.open('GET', url, true);
    req.send('');
};

var playSound = function (buffer) {
    var source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(0);
};

var sClick, sInfo, sError, sTimeup;
window.onload = function () {
    getAudioBuffer('/sounds/click.mp3', function (buffer) {
        sClick = buffer;
    });
    getAudioBuffer('/sounds/info.mp3', function (buffer) {
        sInfo = buffer;
    });
    getAudioBuffer('/sounds/error.mp3', function (buffer) {
        sError = buffer;
    });
    getAudioBuffer('/sounds/timeup.mp3', function (buffer) {
        sTimeup = buffer;
    });

};
