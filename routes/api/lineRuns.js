"use strict"
const express = require('express')
const multer = require('multer')
const publicRouter = express.Router()
const privateRouter = express.Router()
const adminRouter = express.Router()
const lineRun = require('../../models/lineRun').lineRun
const validator = require('validator')
const async = require('async')
const ObjectId = require('mongoose').Types.ObjectId
const logger = require('../../config/logger').mainLogger
const fs = require('fs')
const pathFinder = require('../../helper/pathFinder')
const scoreCalculator = require('../../helper/scoreCalculator')
const auth = require('../../helper/authLevels')
const scoreSheetLinePDF2 = require('../../helper/scoreSheetPDFLine2')
const ACCESSLEVELS = require('../../models/user').ACCESSLEVELS

var socketIo

module.exports.connectSocketIo = function (io) {
  socketIo = io
}

/**
 * @api {get} /runs/line Get runs
 * @apiName GetRun
 * @apiGroup Run
 * @apiVersion 1.0.1
 *
 * @apiParam {Boolean} [populate] Whether to populate references with name
 *
 * @apiSuccess (200) {Object[]} -             Array of runs
 * @apiSuccess (200) {String}   -._id
 * @apiSuccess (200) {String}   -.competition
 * @apiSuccess (200) {String}   -.round
 * @apiSuccess (200) {String}   -.team
 * @apiSuccess (200) {String}   -.field
 * @apiSuccess (200) {String}   -.map
 * @apiSuccess (200) {Number}   -.score
 * @apiSuccess (200) {Object}   -.time
 * @apiSuccess (200) {Number}   -.time.minutes
 * @apiSuccess (200) {Number}   -.time.seconds
 * @apiSuccess (200) {Number}   -.status
 * @apiSuccess (200) {Number}   -.rescuedLiveVictims
 * @apiSuccess (200) {Number}   -.rescuedDeadVictims
 * @apiSuccess (200) {Object[]} -             Array of LoPs
 *
 * @apiError (400) {String} msg The error message
 */
publicRouter.get('/', getLineRuns)

function getLineRuns(req, res) {
  const competition = req.query.competition || req.params.competition

  var query
  if (competition != null && competition.constructor === String) {
    if (req.query['ended'] == 'false') {
      query = lineRun.find({
        competition: competition,
        status: {$lte: 1}
      })
    } else {
      query = lineRun.find({
        competition: competition
      })
    }

  } else if (Array.isArray(competition)) {
    query = lineRun.find({
      competition: {
        $in: competition.filter(ObjectId.isValid)
      }
    })
  } else {
    query = lineRun.find({})
  }

  if (req.query['minimum']) {
    query.select("competition round team field status started startTime sign")
  } else {
    query.select("competition round team field map score raw_score multiplier time status started LoPs comment startTime sign rescueOrder nl group exitBonus evacuationLevel kitLevel")
  }


  if (req.query['populate'] !== undefined && req.query['populate']) {
    query.populate([
      {
        path: "competition",
        select: "name"
      },
      {
        path: "round",
        select: "name"
      },
      {
        path: "team",
        select: "name league teamCode"
      },
      {
        path: "field",
        select: "name league"
      },
      {
        path: "map",
        select: "name"
      }
    ])
  }

  query.lean().exec(function (err, dbRuns) {
    if (err) {
      logger.error(err)
      res.status(400).send({
        msg: "Could not get runs"
      })
    } else if (dbRuns) {

      // Hide map and field from public
      for (let i = 0; i < dbRuns.length; i++) {
        if (!auth.authViewRun(req.user, dbRuns[i], ACCESSLEVELS.NONE + 1)) {
          delete dbRuns[i].map
          delete dbRuns[i].field
          delete dbRuns[i].comment
          delete dbRuns[i].sign
        }else if(!auth.authCompetition(req.user, dbRuns[i].competition, ACCESSLEVELS.VIEW)){
          delete dbRuns[i].comment
          delete dbRuns[i].sign
        }
      }
      res.status(200).send(dbRuns)
    }
  })
}

module.exports.getLineRuns = getLineRuns

publicRouter.get('/latest', getLatestLineRun)

function getLatestLineRun(req, res) {
  const competition = req.query.competition || req.params.competition
  const field = req.query.field || req.params.field
  const fields = req.query.fields

  var selection = {
    competition: competition,
    field: field
  }
  if (selection.competition == undefined) {
    delete selection.competition
  }
  if (selection.field == undefined) {
    delete selection.field
  }

  if (fields != null) {
    selection.field = {
      $in: fields
    }
  }

  var query = lineRun.findOne(selection).sort("-updatedAt")

  if (req.query['populate'] !== undefined && req.query['populate']) {
    query.populate(["round",{ path: "team", select: "name league teamCode"}, "field", "competition", {
      path: 'tiles',
      populate: {
        path: 'tileType'
      }
    }])
  }

  query.lean().exec(function (err, dbRun) {
    if (err) {
      logger.error(err)
      res.status(400).send({
        msg: "Could not get run"
      })
    } else if (dbRun) {
      // Hide map and field from public
      if (!auth.authViewRun(req.user, dbRun, ACCESSLEVELS.NONE + 1)) {
        delete dbRun.map
        delete dbRun.field
        delete dbRun.comment
        delete dbRun.sign
      }
      res.status(200).send(dbRun)
    }
  })
}

module.exports.getLatestLineRun = getLatestLineRun

privateRouter.get('/find/team_status/:competitionid/:teamid/:status', function (req, res, next) {
  var id = req.params.competitionid
  var teamId = req.params.teamid
  var status = req.params.status
  if (!ObjectId.isValid(id)) {
    return next()
  }
  if (!ObjectId.isValid(teamId)) {
    return next()
  }
  var query = lineRun.find({
    competition: id,
    team: teamId,
    status: status
  }, "competition round team field map score time started LoPs startTime rescueOrder nl")
  query.populate([
    {
      path: "competition",
      select: "name"
    },
    {
      path: "round",
      select: "name"
    },
    {
      path: "team",
      select: "name league"
    },
    {
      path: "field",
      select: "name league"
    },
    {
      path: "map",
      select: "name"
    }
  ])
  query.exec(function (err, data) {
    if (err) {
      logger.error(err)
      res.status(400).send({
        msg: "Could not get runs"
      })
    } else {
      res.status(200).send(data)
    }
  })
})

publicRouter.get('/find/:competitionid/:field/:status', function (req, res, next) {
  var id = req.params.competitionid
  var field_id = req.params.field
  var status = req.params.status
  if (!ObjectId.isValid(id)) {
    return next()
  }
  if (!ObjectId.isValid(field_id)) {
    return next()
  }
  var query = lineRun.find({
    competition: id,
    field: field_id,
    status: status
  }, "field team competition status")
  query.populate([{ path: "team", select: "name league teamCode"}])
  query.exec(function (err, data) {
    if (err) {
      logger.error(err)
      res.status(400).send({
        msg: "Could not get runs"
      })
    } else {
      res.status(200).send(data)
    }
  })
})




/**
 * @api {get} /runs/line/:runid Get run
 * @apiName GetRun
 * @apiGroup Run
 * @apiVersion 1.0.0
 *
 * @apiParam {String} runid The run id
 *
 * @apiParam {Boolean} [populate] Whether to populate object references
 *
 * @apiSuccess (200) {String}       _id
 * @apiSuccess (200) {String}       competition
 * @apiSuccess (200) {String}       round
 * @apiSuccess (200) {String}       team
 * @apiSuccess (200) {String}       field
 * @apiSuccess (200) {String}       map
 *
 * @apiSuccess (200) {Object[]}     tiles
 * @apiSuccess (200) {Boolean}      tiles.isDropTile
 * @apiSuccess (200) {Object}       tiles.scoredItems
 * @apiSuccess (200) {Boolean}      tiles.scoredItems.obstacles
 * @apiSuccess (200) {Boolean}      tiles.scoredItems.speedbumps
 * @apiSuccess (200) {Boolean}      tiles.scoredItems.intersection
 * @apiSuccess (200) {Boolean}      tiles.scoredItems.gaps
 * @apiSuccess (200) {Boolean}      tiles.scoredItems.dropTile
 * @apiSuccess (200) {Number[]}     LoPs
 * @apiSuccess (200) {Number}       evacuationLevel
 * @apiSuccess (200) {Boolean}      exitBonus
 * @apiSuccess (200) {Number}       rescuedLiveVictims
 * @apiSuccess (200) {Number}       rescuedDeadVictims
 * @apiSuccess (200) {Number}       score
 * @apiSuccess (200) {Boolean}      showedUp
 * @apiSuccess (200) {Object}       time
 * @apiSuccess (200) {Number{0-8}}  time.minutes
 * @apiSuccess (200) {Number{0-59}} time.seconds
 *
 * @apiError (400) {String} err The error message
 * @apiError (400) {String} msg The error message
 */
publicRouter.get('/:runid', function (req, res, next) {
  const id = req.params.runid

  if (!ObjectId.isValid(id)) {
    return next()
  }

  const query = lineRun.findById(id, "-__v")

  if (req.query['populate'] !== undefined && req.query['populate']) {
      query.populate(["round", { path: "team", select: "name league"}, "field", "competition"])
  }

  query.lean().exec(function (err, dbRun) {
    if (err) {
      logger.error(err)
      return res.status(400).send({
        err: err.message,
        msg: "Could not get run"
      })
    } else if (dbRun) {
      // Hide map and field from public
      let authResult = auth.authViewRun(req.user, dbRun, ACCESSLEVELS.NONE + 1);
      if (authResult == 0) return res.status(403)
      if (authResult == 2) {
        delete dbRun.comment
        delete dbRun.sign
      }
      return res.status(200).send(dbRun)
    }
  })
})

/**
 * @api {put} /runs/line/:runid Update run
 * @apiName PutRun
 * @apiGroup Run
 * @apiVersion 1.0.0
 *
 * @apiParam {String} runid The run id

 * @apiParam {Object[]}     [tiles]
 * @apiParam {Boolean}      [tiles.isDropTile]
 * @apiParam {Object}       [tiles.scoredItems]
 * @apiParam {Boolean}      [tiles.scoredItems.obstacles]
 * @apiParam {Boolean}      [tiles.scoredItems.speedbumps]
 * @apiParam {Boolean}      [tiles.scoredItems.intersection]
 * @apiParam {Boolean}      [tiles.scoredItems.gaps]
 * @apiParam {Boolean}      [tiles.scoredItems.dropTile]
 * @apiParam {Number[]}     [LoPs]
 * @apiParam {Number=1,2}   [evacuationLevel]
 * @apiParam {Boolean}      [exitBonus]
 * @apiParam {Number}       [rescuedLiveVictims]
 * @apiParam {Number}       [rescuedDeadVictims]
 * @apiParam {Boolean}      [showedUp]
 * @apiParam {Object}       [time]
 * @apiParam {Number{0-8}}  [time.minutes]
 * @apiParam {Number{0-59}} [time.seconds]
 *
 * @apiSuccess (200) {String} msg   Success msg
 * @apiSuccess (200) {String} score The current score
 *
 * @apiError (400) {String} err The error message
 * @apiError (400) {String} msg The error message
 */
privateRouter.put('/:runid', function (req, res, next) {
  const id = req.params.runid
  if (!ObjectId.isValid(id)) {
    return next()
  }

  var statusUpdate = false;
  const run = req.body

  // Exclude fields that are not allowed to be publicly changed
  delete run._id
  delete run.__v
  delete run.map
  delete run.competition
  delete run.round
  delete run.team
  delete run.field
  delete run.score

  lineRun.findById(id)
  //.select("-_id -__v -competition -round -team -field -score")
    .populate([{
      path: 'map',
      populate: {
        select: 'indexCount',
        path: 'tiles.tileType'
      }
    }])
    .populate("competition.rule")
    .exec(function (err, dbRun) {
      if (err) {
        logger.error(err)
        res.status(400).send({
          msg: "Could not get run",
          err: err.message
        })
      } else if (dbRun) {
        console.log(dbRun.tiles)
        if (!auth.authCompetition(req.user, dbRun.competition._id, ACCESSLEVELS.JUDGE)) {
          return res.status(401).send({
            msg: "You have no authority to access this api!!"
          })
        }
        if (run.tiles != null && run.tiles.constructor === Object) { // Handle dict as "sparse" array
          const tiles = run.tiles
          run.tiles = []
          Object.keys(tiles).forEach(function (key) {
            if (!isNaN(key)) {
              run.tiles[key] = tiles[key]
            }
          })
        }

        if (run.LoPs != null && run.LoPs.length != dbRun.LoPs.length) {
          dbRun.LoPs.length = run.LoPs.length
        }

        if (run.rescueOrder != null) {
          dbRun.rescueOrder = run.rescueOrder;
        }

        if (run.nl != null) {
          if (run.nl.silverTape != null) dbRun.nl.silverTape = run.nl.silverTape
          if (run.nl.greenTape != null) dbRun.nl.greenTape = run.nl.greenTape
          if (run.nl.misidentification != null) dbRun.nl.misidentification = run.nl.misidentification
        }
          
        if (run.status){
            if(dbRun.status > run.status) delete run.status;
        }

          
        let prevStatus = dbRun.status;

        // Recursively updates properties in "dbObj" from "obj"
        const copyProperties = function (obj, dbObj) {
          for (let prop in obj) {
            if (obj.constructor == Array ||
              (obj.hasOwnProperty(prop) &&
                (dbObj.hasOwnProperty(prop) ||
                  (dbObj.get !== undefined &&
                    dbObj.get(prop) !== undefined)))) { // Mongoose objects don't have hasOwnProperty
              if (typeof obj[prop] == 'object' && dbObj[prop] != null) { // Catches object and array
                copyProperties(obj[prop], dbObj[prop])

                if (dbObj.markModified !== undefined) {
                  dbObj.markModified(prop)
                }
              } else if (obj[prop] !== undefined) {
                //logger.debug("copy " + prop)
                dbObj[prop] = obj[prop]
              }
            } else {
              return new Error("Illegal key: " + prop)
            }
          }
        }

        err = copyProperties(run, dbRun);

        if (err) {
          logger.error(err)
          return res.status(400).send({
            err: err.message,
            msg: "Could not save run"
          })
        }
          
        if(prevStatus != dbRun.status) statusUpdate = 1;


        let cal = scoreCalculator.calculateLineScore(dbRun);
        if(!cal){
          logger.error("Value Error");
          return res.status(202).send({
            msg: "Try again later"
          })
        }

        dbRun.score = cal.score;
        dbRun.raw_score = cal.raw_score;
        dbRun.multiplier = cal.multiplier;

        if (dbRun.score > 0 || dbRun.time.minutes != 0 ||
          dbRun.time.seconds != 0 || dbRun.status >= 2) {
          dbRun.started = true
        } else {
          dbRun.started = false
        }

        dbRun.save(function (err) {
          if (err) {
            logger.error(err)
            return res.status(400).send({
              err: err.message,
              msg: "Could not save run"
            })
          } else {
            if (socketIo !== undefined) {
              socketIo.sockets.in('runs/line').emit('changed')
              socketIo.sockets.in('runs/line/' + dbRun.competition._id).emit('changed')
              socketIo.sockets.in('runs/' + dbRun._id).emit('data', dbRun)
              socketIo.sockets.in('fields/' +dbRun.field).emit('data', {newRun: dbRun._id})
              if(statusUpdate){
                socketIo.sockets.in('runs/line/' + dbRun.competition._id + '/status').emit('LChanged')
                console.log("EMIT");
              }
            }
            return res.status(200).send({
              msg: "Saved run",
              score: dbRun.score,
              raw_score: dbRun.raw_score,
              multiplier: dbRun.multiplier
            })
          }
        })
      }
    })
})


adminRouter.get('/scoresheet2', function (req, res, next) {
  const run = req.query.run || req.params.run;
  const competition = req.query.competition || req.params.competition;
  const field = req.query.field || req.params.field;
  const round = req.query.round || req.params.round;
  const startTime = req.query.startTime || req.params.startTime;
  const endTime = req.query.endTime || req.params.endTime;

  if (!competition && !run && !round) {
    return next();
  }

  let queryObj = {};
  let sortObj = {};
  if (ObjectId.isValid(competition)) {
    queryObj.competition = ObjectId(competition);
  }
  if (ObjectId.isValid(field)) {
    queryObj.field = ObjectId(field);
  }
  if (ObjectId.isValid(round)) {
    queryObj.round = ObjectId(round);
  }
  if (ObjectId.isValid(run)) {
    queryObj._id = ObjectId(run);
  }

  sortObj.field = 1;
  sortObj.startTime = 1; // sorting by field has the highest priority, followed by time

  if (startTime && endTime) {
    queryObj.startTime = {$gte: parseInt(startTime), $lte: parseInt(endTime)}
  } else {
    if (startTime) {
      queryObj.startTime = {$gte: parseInt(startTime)}
    } else if (endTime) {
      queryObj.startTime = {$lte: parseInt(endTime)}
    }
  }

  let query = lineRun.find(queryObj).sort(sortObj);

  query.select("competition round team field map startTime");
  query.populate([
    {
      path: "competition",
      select: "name rule logo"
    },
    {
      path: "round",
      select: "name"
    },
    {
      path: "team",
      select: "name league teamCode"
    },
    {
      path: "field",
      select: "name"
    },
    {
      path: "map",
      select: "name height width length numberOfDropTiles finished startTile tiles indexCount victims EvacuationAreaLoPIndex",
      populate: {
        path: 'tiles.tileType'
      }
    }
  ]);

  query.lean().exec(function (err, dbRuns) {
    if (err) {
      logger.error(err)
      res.status(400).send({
        msg: "Could not get runs"
      })
    } else if (dbRuns) {
      scoreSheetLinePDF2.generateScoreSheet(res, dbRuns);
    }
  })
});


/**
 * @api {delete} /runs/line/:runid Delete run
 * @apiName DeleteRun
 * @apiGroup Run
 * @apiVersion 1.0.0
 *
 * @apiParam {String} runid The run id
 *
 * @apiSuccess (200) {String} msg Success msg
 *
 * @apiError (400) {String} err The error message
 */
/**
 * @api {delete} /runs/line/:runids Delete run
 * @apiName DeleteRun
 * @apiGroup Run
 * @apiVersion 1.1.0
 *
 * @apiParam {String} runids The run ids
 *
 * @apiSuccess (200) {String} msg Success msg
 *
 * @apiError (400) {String} err The error message
 */
adminRouter.delete('/:runids', function (req, res) {
  var ids = req.params.runids.split(",");
  if (!ObjectId.isValid(ids[0])) {
    return next()
  }
  lineRun.findById(ids[0])
    .select("competition")
    .exec(function (err, dbRun) {
      if (err) {
        logger.error(err)
        res.status(400).send({
          msg: "Could not get run",
          err: err.message
        })
      } else if (dbRun) {
        if (!auth.authCompetition(req.user, dbRun.competition, ACCESSLEVELS.ADMIN)) {
          return res.status(401).send({
            msg: "You have no authority to access this api"
          })
        }
      }
      lineRun.deleteMany({
        '_id': {$in: ids},
        'competition': dbRun.competition
      }, function (err) {
        if (err) {
          logger.error(err)
          res.status(400).send({
            msg: "Could not remove run",
            err: err.message
          })
        } else {
          res.status(200).send({
            msg: "Run has been removed!"
          })
        }
      })
    })
})


/**
 * @api {post} /runs/line Create new run
 * @apiName PostRun
 * @apiGroup Run
 * @apiVersion 1.0.0
 *
 * @apiParam {String} competition The competition id
 * @apiParam {String} round       The round id
 * @apiParam {String} team        The team id
 * @apiParam {String} field       The field id
 * @apiParam {String} map         The map id
 *
 * @apiSuccess (200) {String} msg Success msg
 * @apiSuccess (200) {String} id  The new run id
 *
 * @apiError (400) {String} err The error message
 */
adminRouter.post('/', function (req, res) {
  const run = req.body

  new lineRun({
    competition: run.competition,
    round: run.round,
    team: run.team,
    field: run.field,
    map: run.map,
    startTime: run.startTime,
    group: run.group
  }).save(function (err, data) {
    if (err) {
      logger.error(err)
      return res.status(400).send({
        msg: "Error saving run in db",
        err: err.message
      })
    } else {
      res.location("/api/runs/" + data._id)
      return res.status(201).send({
        err: "New run has been saved",
        id: data._id
      })
    }
  })
})



adminRouter.get('/apteam/:cid/:teamid/:group', function (req, res, next) {
  const cid = req.params.cid
  const team = req.params.teamid
  const group = req.params.group
  if (!ObjectId.isValid(cid)) {
    return next()
  }
  if (!ObjectId.isValid(team)) {
    return next()
  }

  if (!auth.authCompetition(req.user, cid, ACCESSLEVELS.ADMIN)) {
    return res.status(401).send({
      msg: "You have no authority to access this api!!"
    })
  }


  lineRun.find({
    'competition': cid,
    'group': group
  })
    .exec(function (err, dbRun) {
      if (err) {
        logger.error(err)
        res.status(400).send({
          msg: "Could not get run",
          err: err.message
        })
      } else if (dbRun) {
        var resp = [];
        for (let run of dbRun) {
          run.team = team;
          run.group = null;
          run.save(function (err) {
            if (err) {
              logger.error(err)
              return res.status(400).send({
                err: err.message,
                msg: "Could not save run"
              })
            } else {
            }
          })
          let col = {
            time: run.startTime,
            field: run.field
          };
          resp.push(col);
        }
        //res.send(dbRun);
        //logger.debug(dbRun);


        return res.status(200).send({
          msg: "Saved change",
          data: resp
        })
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
