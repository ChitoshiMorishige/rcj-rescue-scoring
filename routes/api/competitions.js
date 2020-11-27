//========================================================================
//                          Libraries
//========================================================================

const express = require('express')
const publicRouter = express.Router()
const privateRouter = express.Router()
const adminRouter = express.Router()
const competitiondb = require('../../models/competition')
const lineMapDb = require('../../models/lineMap')
const lineRunDb = require('../../models/lineRun')
const mazeMapDb = require('../../models/mazeMap')
const mazeRunDb = require('../../models/mazeRun')

const userdb = require('../../models/user')
const lineMapsApi = require('./lineMaps')
const lineRunsApi = require('./lineRuns')
const mazeMapsApi = require('./mazeMaps')
const mazeRunsApi = require('./mazeRuns')
const query = require('../../helper/query-helper')
const validator = require('validator')
const async = require('async')
const ObjectId = require('mongoose').Types.ObjectId
const logger = require('../../config/logger').mainLogger
const fs = require('fs')
const auth = require('../../helper/authLevels')
const { leagues } = require('../../leagues')


const LINE_LEAGUES = competitiondb.LINE_LEAGUES
const MAZE_LEAGUES = competitiondb.MAZE_LEAGUES
const LEAGUES = competitiondb.LEAGUES
const LEAGUES_JSON = competitiondb.LEAGUES_JSON;

const ACCESSLEVELS = require('../../models/user').ACCESSLEVELS


publicRouter.get('/', function (req, res) {
    competitiondb.competition.find({}).lean().exec(function (err, data) {
        if (err) {
            logger.error(err)
            res.status(400).send({
                msg: "Could not get competitions",
                err: err.message
            })
        } else {
            for(let i=0;i<data.length;i++){
                if(req.user) data[i].authLevel = auth.competitionLevel(req.user,data[i]._id);
                else data[i].authLevel = 0;
                if(!data[i].color) data[i].color = "000000";
                if(!data[i].bkColor) data[i].bkColor = "ffffff";
                if(!data[i].message) data[i].message = "";
                if(!data[i].description) data[i].description = "";
                if(!data[i].logo) data[i].logo = "/images/NoImage.png";
                if(data[i].documents) delete data[i].documents.leagues;
            }
            
            res.status(200).send(data)
        }
    })
})

publicRouter.get('/rules', function (req, res) {
    res.send(competitiondb.competition.schema.path('rule').enumValues)
})

publicRouter.get('/leagues', async function (req, res, next) {
    res.send(LEAGUES_JSON);
})

publicRouter.get('/leagues/:league', async function (req, res, next) {
    var league = req.params.league;

    if (LEAGUES.filter(function (elm){
        return elm.indexOf(league) != -1;
    }).length == 0){
        return next()
    }

    for(let j in LEAGUES_JSON){
        if(LEAGUES_JSON[j].id == league){
            let ret = {
                id: LEAGUES_JSON[j].id,
                type: LEAGUES_JSON[j].type,
                name: LEAGUES_JSON[j].name
            };
            res.send(ret);
            break;
        }
    }
})


publicRouter.get('/:competition', function (req, res, next) {
    const id = req.params.competition;

    if (!ObjectId.isValid(id)) {
        return next()
    }

    competitiondb.competition.findById(id).lean().exec(function (err, data) {
        if (err || !data) {
            logger.error(err);
            res.status(400).send({
                msg: "Could not get competition"
            })
        } else {
            if(!data.color) data.color = "000000";
            if(!data.bkColor) data.bkColor = "ffffff";
            if(!data.message) data.message = "";
            if(!data.description) data.description = "";
            if(!data.logo) data.logo = "/images/noLogo.png";
            if(data.documents) delete data.documents.leagues;
            res.status(200).send(data)
        }
    })
})

publicRouter.get('/:competition/documents/:leagueId', function (req, res, next) {
    const id = req.params.competition;
    const lid = req.params.leagueId;

    if (!ObjectId.isValid(id)) {
        return next()
    }

    if (LEAGUES.filter(function (elm){
        return elm.indexOf(lid) != -1;
    }).length == 0){
        return next()
    }

    competitiondb.competition.aggregate([
        {$match: {_id: ObjectId(id)}},
        {$unwind: "$documents.leagues"},
        {$match: { 'documents.leagues.league': lid}}
      ]).exec(function (err, data) {
        if (err || !data) {
            logger.error(err);
            res.status(400).send({
                msg: "Could not get competition"
            })
        } else {
            if(data[0]){
                if(data[0].documents.leagues.review) delete data[0].documents.leagues.review;
                res.status(200).send(data[0].documents.leagues)
            }
            else res.status(200).send(data)
        }
    })
})

privateRouter.get('/:competition/documents/:leagueId/review', function (req, res, next) {
    const id = req.params.competition;
    const lid = req.params.leagueId;

    if (!ObjectId.isValid(id)) {
        return next()
    }

    if (LEAGUES.filter(function (elm){
        return elm.indexOf(lid) != -1;
    }).length == 0){
        return next()
    }

    if (!auth.authCompetition(req.user, id, ACCESSLEVELS.VIEW)) {
        return res.status(401).send({
            msg: "You have no authority to access this api"
        })
    }

    competitiondb.competition.aggregate([
        {$match: {_id: ObjectId(id)}},
        {$unwind: "$documents.leagues"},
        {$match: { 'documents.leagues.league': lid}}
      ]).exec(function (err, data) {
        if (err || !data) {
            logger.error(err);
            res.status(400).send({
                msg: "Could not get competition"
            })
        } else {
            if(data[0]) res.status(200).send(data[0].documents.leagues)
            else res.status(200).send(data)
        }
    })
})

adminRouter.put('/:competitionid', function (req, res, next) {
    var id = req.params.competitionid;
    let data = req.body;

    if (!ObjectId.isValid(id)) {
        return next()
    }
    if (!auth.authCompetition(req.user, id, ACCESSLEVELS.ADMIN)) {
        return res.status(401).send({
            msg: "You have no authority to access this api"
        })
    }

    competitiondb.competition.findById(id)
      .exec(function (err, dbCompetition) {
            if (err) {
                logger.error(err)
                res.status(400).send({
                    msg: "Could not get competition",
                    err: err.message
                })
            } else if (dbCompetition) {
                if(data.name != null) dbCompetition.name = data.name;
                if(data.rule != null) dbCompetition.rule = data.rule;
                if(data.logo != null) dbCompetition.logo = data.logo;
                if(data.bkColor != null) dbCompetition.bkColor = data.bkColor;
                if(data.color != null) dbCompetition.color = data.color;
                if(data.message != null) dbCompetition.message = data.message;
                if(data.description != null) dbCompetition.description = data.description;


                if(data.ranking != null){
                    dbCompetition.ranking = [];
                    for(let i in data.ranking){
                        let tmp = {
                            'league': data.ranking[i].id,
                            'num': data.ranking[i].count
                        }
                        dbCompetition.ranking.push(tmp);
                    }
                }

                if(data.documents.enable != null) dbCompetition.documents.enable = data.documents.enable;
                if(data.documents.deadline != null) dbCompetition.documents.deadline = data.documents.deadline;

                if(data.documents.league != null){
                    let updated = false;
                    for(let l of dbCompetition.documents.leagues){
                        if(l.league == data.documents.league){
                            if(data.documents.notifications != null) l.notifications = data.documents.notifications;
                            if(data.documents.blocks != null) l.blocks = data.documents.blocks;
                            if(data.documents.languages != null) l.languages = data.documents.languages;
                            if(data.documents.review != null) l.review = data.documents.review;
                            updated = true;
                        }
                    }
                    if(!updated){
                        let tmp = {
                            league: data.documents.league,
                            notifications: data.documents.notifications || [],
                            blocks: data.documents.blocks || [],
                            languages: data.documents.languages || [],
                            review: data.documents.review || []
                        }
                        dbCompetition.documents.leagues.push(tmp);
                    }
                }


                dbCompetition.save(function (err) {
                    if (err) {
                        logger.error(err)
                        return res.status(400).send({
                            err: err.message,
                            msg: "Could not save changes"
                        })
                    } else {
                        res.status(200).send({
                            msg: "Settings has been saved"
                        })
                    }
                })

            }
        }

      );
})

adminRouter.get('/:competition/teams/documents', function (req, res, next) {
    const id = req.params.competition;

    if (!ObjectId.isValid(id)) {
        return next()
    }

    if (!auth.authCompetition(req.user, id, ACCESSLEVELS.ADMIN)) {
        return res.status(401).send({
            msg: "You have no authority to access this api"
        })
    }

    competitiondb.team.find({
        competition: id
    }).select("_id name competition league country teamCode document.deadline document.enabled document.token document.public").lean().exec(function (err, data) {
        if (err) {
            logger.error(err)
            res.status(400).send({
                msg: "Could not get teams",
                err: err.message
            })
        } else {
            res.status(200).send(data)
        }
    })
})

adminRouter.put('/:competition/teams/documents', function (req, res, next) {
    const id = req.params.competition;
    const team = req.body;

    if (!ObjectId.isValid(id)) {
        return next()
    }

    if (!auth.authCompetition(req.user, team.competition, ACCESSLEVELS.ADMIN)) {
        return res.status(401).send({
            msg: "You have no authority to access this api"
        })
    }

    competitiondb.team.findById(team._id).exec(function (err, dbTeam) {
        if (err) {
            logger.error(err)
            res.status(400).send({
                msg: "Could not get teams",
                err: err.message
            })
        } else {
            if(team.document.deadline != null) dbTeam.document.deadline = team.document.deadline;
            dbTeam.document.enabled = team.document.enabled;
            dbTeam.document.public = team.document.public;
            dbTeam.save(function (err) {
                if (err) {
                    logger.error(err)
                    return res.status(400).send({
                        err: err.message,
                        msg: "Could not save changes"
                    })
                } else {
                    return res.status(200).send({
                        msg: "Saved changes"
                    })
                }
            })
        }
    })
})

adminRouter.get('/:competition/adminTeams', function (req, res, next) {
    const id = req.params.competition;

    if (!ObjectId.isValid(id)) {
        return next();
    }

    if (!auth.authCompetition(req.user, id, ACCESSLEVELS.ADMIN)) {
        return next();
    }

    competitiondb.team.find({
        competition: id
    },'_id name competition league country teamCode email document.token document.deadline').lean().exec(function (err, data) {
        if (err) {
            logger.error(err)
            res.status(400).send({
                msg: "Could not get teams",
                err: err.message
            })
        } else {
            res.status(200).send(data)
        }
    })
})


publicRouter.get('/:competition/teams', function (req, res, next) {
    const id = req.params.competition;

    if (!ObjectId.isValid(id)) {
        return next()
    }

    competitiondb.team.find({
        competition: id
    },'_id name competition league inspected country checkin teamCode document.public').lean().exec(function (err, data) {
        if (err) {
            logger.error(err)
            res.status(400).send({
                msg: "Could not get teams",
                err: err.message
            })
        } else {
            res.status(200).send(data)
        }
    })
})





publicRouter.get('/:competition/teams/:teamid', function (req, res, next) {
    const id = req.params.competition
    const tid = req.params.teamid

    if (!ObjectId.isValid(id)) {
        return next()
    }
    if (!ObjectId.isValid(tid)) {
        return next()
    }

    competitiondb.team.findOne({
        competition: id,
        _id: tid
    }).lean().exec(function (err, data) {
        if (err) {
            logger.error(err)
            res.status(400).send({
                msg: "Could not get teams",
                err: err.message
            })
        } else {
            delete data.document;
            delete data.email;
            delete data.review;
            res.status(200).send(data)
        }
    })
})

publicRouter.get('/:competition/:league/teams', function (req, res, next) {
    const id = req.params.competition
    const league = req.params.league

    if (!ObjectId.isValid(id)) {
        return next()
    }

    let leagueArr = [];
    if(league == "line"){
        leagueArr = LINE_LEAGUES;
    }else if(league == "maze"){
        leagueArr = MAZE_LEAGUES;
    }else if (LEAGUES.filter(function (elm){
      return elm.indexOf(league) != -1;
    }).length == 0){
      return next()
    }else{
        leagueArr.push(league)
    }
    
    

    competitiondb.team.find({
        competition: id,
        league: { $in: leagueArr }
    },'_id name competition league inspected country checkin').lean().exec(function (err, data) {
        if (err) {
            logger.error(err)
            res.status(400).send({
                msg: "Could not get teams",
                err: err.message
            })
        } else {
            res.status(200).send(data)
        }
    })
})


publicRouter.get('/:competition/line/runs', function (req, res, next) {
    var id = req.params.competition

    if (!ObjectId.isValid(id)) {
        return next()
    }
    return lineRunsApi.getLineRuns(req, res, next)
})

publicRouter.get('/:competition/line/latestrun', function (req, res, next) {
    var id = req.params.competition

    if (!ObjectId.isValid(id)) {
        return next()
    }
    return lineRunsApi.getLatestLineRun(req, res, next)
})

publicRouter.get('/:competition/maze/runs', function (req, res, next) {
    var id = req.params.competition

    if (!ObjectId.isValid(id)) {
        return next()
    }
    return mazeRunsApi.getMazeRuns(req, res, next)
})

publicRouter.get('/:competition/maze/latestrun', function (req, res, next) {
    var id = req.params.competition

    if (!ObjectId.isValid(id)) {
        return next()
    }
    return mazeRunsApi.getLatestMazeRun(req, res, next)
})

privateRouter.get('/:competition/:league/maps', function (req, res, next) {
    const id = req.params.competition
    const league = req.params.league

    if (!ObjectId.isValid(id)) {
        return next()
    }


    if (LINE_LEAGUES.filter(function (elm){
      return elm.indexOf(league) != -1;
    }).length != 0){
      return lineMapsApi.getLineMaps(req, res, next)
    }

    if (MAZE_LEAGUES.filter(function (elm){
      return elm.indexOf(league) != -1;
    }).length != 0){
      return mazeMapsApi.getMazeMaps(req, res, next)
    }

    return next()
});


privateRouter.get('/:competition/line/maps', function (req, res, next) {
    const id = req.params.competition

    if (!ObjectId.isValid(id)) {
        return next()
    }

    return lineMapsApi.getLineMaps(req, res, next)
})

privateRouter.get('/:competition/maze/maps', function (req, res, next) {
    const id = req.params.competition

    if (!ObjectId.isValid(id)) {
        return next()
    }

    return mazeMapsApi.getMazeMaps(req, res, next)
})

publicRouter.get('/:competition/fields', function (req, res, next) {
    var id = req.params.competition

    if (!ObjectId.isValid(id)) {
        return next()
    }

    competitiondb.field.find({
        competition: id
    }).lean().exec(function (err, data) {
        if (err) {
            logger.error(err)
            res.status(400).send({
                msg: "Could not get fields",
                err: err.message
            })
        } else {
            res.status(200).send(data)
        }
    })
})

publicRouter.get('/:competition/:league/fields', function (req, res, next) {
    const id = req.params.competition
    const league = req.params.league

    if (!ObjectId.isValid(id)) {
        return next()
    }

    let leagueArr = [];
    if(league == "line"){
        leagueArr = LINE_LEAGUES;
    }else if(league == "maze"){
        leagueArr = MAZE_LEAGUES;
    }else if (LEAGUES.filter(function (elm){
      return elm.indexOf(league) != -1;
    }).length == 0){
      return next()
    }else{
        leagueArr.push(league)
    }
    

    competitiondb.field.find({
        competition: id,
        league: { $in: leagueArr }
    }).lean().exec(function (err, data) {
        if (err) {
            logger.error(err)
            res.status(400).send({
                msg: "Could not get fields",
                err: err.message
            })
        } else {
            res.status(200).send(data)
        }
    })
})

publicRouter.get('/:competitionid/fields/:name', function (req, res, next) {
    var id = req.params.competitionid
    var name = req.params.name

    if (!ObjectId.isValid(id)) {
        return next()
    }

    competitiondb.field.find({
        competition: id,
        name: name
    }, function (err, data) {
        if (err) {
            logger.error(err)
            res.status(400).send({
                msg: "Could not get fields"
            })
        } else {
            res.status(200).send(data)
        }
    }).select("_id")
})

publicRouter.get('/:competition/rounds', function (req, res, next) {
    var id = req.params.competition

    if (!ObjectId.isValid(id)) {
        return next()
    }

    competitiondb.round.find({
        competition: id
    }).lean().exec(function (err, data) {
        if (err) {
            logger.error(err)
            res.status(400).send({
                msg: "Could not get rounds",
                err: err.message
            })
        } else {
            res.status(200).send(data)
        }
    })
})

publicRouter.get('/:competitionid/rounds/:name', function (req, res, next) {
    var id = req.params.competitionid
    var name = req.params.name

    if (!ObjectId.isValid(id)) {
        return next()
    }

    competitiondb.round.find({
        competition: id,
        name: name
    }, function (err, data) {
        if (err) {
            logger.error(err)
            res.status(400).send({
                msg: "Could not get rounds"
            })
        } else {
            res.status(200).send(data)
        }
    }).select("_id")
})

publicRouter.get('/:competition/:league/rounds', function (req, res, next) {
    var id = req.params.competition
    const league = req.params.league

    if (!ObjectId.isValid(id)) {
        return next()
    }

    let leagueArr = [];
    if(league == "line"){
        leagueArr = LINE_LEAGUES;
    }else if(league == "maze"){
        leagueArr = MAZE_LEAGUES;
    }else if (LEAGUES.filter(function (elm){
      return elm.indexOf(league) != -1;
    }).length == 0){
      return next()
    }else{
        leagueArr.push(league)
    }

    competitiondb.round.find({
        competition: id,
        league: { $in: leagueArr }
    }).lean().exec(function (err, data) {
        if (err) {
            logger.error(err)
            res.status(400).send({
                msg: "Could not get rounds",
                err: err.message
            })
        } else {
            res.status(200).send(data)
        }
    })
})

adminRouter.post('/', function (req, res) {

    const competition = req.body

    new competitiondb.competition({
        name: competition.name,
        rule: competition.rule
    }).save(function (err, data) {
        if (err) {
            logger.error(err)
            res.status(
              400).send({
                msg: "Error saving competition",
                err: err.message
            })
        } else {
            const userid = req.user._id
            const competitionid = data._id
            const aLevel = ACCESSLEVELS.ADMIN

            userdb.user.findById(userid)
                .exec(function (err, dbUser) {
                        if (err) {
                            logger.error(err)
                            res.status(400).send({
                                msg: "Could not get user",
                                err: err.message
                            })
                        } else if (dbUser) {

                            var newData = {
                                id: competitionid,
                                accessLevel: aLevel
                            }
                            dbUser.competitions.push(newData)

                            dbUser.save(function (err) {
                                if (err) {
                                    logger.error(err)
                                    return res.status(400).send({
                                        err: err.message,
                                        msg: "Could not save changes"
                                    })
                                } else {
                                    res.status(201).send({
                                        msg: "New competition has been saved",
                                        id: data._id
                                    })
                                }
                            })

                        }
                    }

                )
        }
    })
})

adminRouter.delete('/:competitionid', function (req, res, next) {
    var id = req.params.competitionid

    if (!ObjectId.isValid(id)) {
        return next()
    }
    if (!auth.authCompetition(req.user, id, ACCESSLEVELS.ADMIN)) {
        return res.status(401).send({
            msg: "You have no authority to access this api"
        })
    }

    competitiondb.competition.deleteMany({
        _id: id
    }, function (err) {
        if (err) {
            logger.error(err)
            res.status(400).send({
                msg: "Could not remove competition",
                err: err.message
            })
        } else {
            res.status(200).send({
                msg: "Competition has been removed!"
            })
            let path = __dirname + "/../../documents/" + id;
            fs.rmdir(path, { recursive: true },(err) => {
                if (err) {
                    logger.error(err.message);
                }
            });
        }
    })

    competitiondb.round.deleteMany({
        competition: id
    }, function (err) {
        if (err) {
            logger.error(err)
        }
    })

    competitiondb.field.deleteMany({
        competition: id
    }, function (err) {
        if (err) {
            logger.error(err)
        }
    })

    competitiondb.team.deleteMany({
        competition: id
    }, function (err) {
        if (err) {
            logger.error(err)
        }
    })

    lineRunDb.lineRun.deleteMany({
        competition: id
    }, function (err) {
        if (err) {
            logger.error(err)
        }
    })

    lineMapDb.lineMap.deleteMany({
        competition: id
    }, function (err) {
        if (err) {
            logger.error(err)
        }
    })

    mazeRunDb.mazeRun.deleteMany({
        competition: id
    }, function (err) {
        if (err) {
            logger.error(err)
        }
    })

    mazeMapDb.mazeMap.deleteMany({
        competition: id
    }, function (err) {
        if (err) {
            logger.error(err)
        }
    })


})





publicRouter.all('*', function (req, res, next) {
    next()
})
privateRouter.all('*', function (req, res, next) {
    next()
})

module.exports.public = publicRouter
module.exports.private = privateRouter
module.exports.admin = adminRouter
