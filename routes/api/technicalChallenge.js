const express = require('express');

const publicRouter = express.Router();
const privateRouter = express.Router();
const adminRouter = express.Router();
const { ObjectId } = require('mongoose').Types;
const logger = require('../../config/logger').mainLogger;
const { technicalChallenge } = require('../../models/competition');
const auth = require('../../helper/authLevels');
const { ACCESSLEVELS } = require('../../models/user');
const competitiondb = require('../../models/competition');
const initRunData = require('../../helper/initRunData');
const { leagues } = require('../../leagues');

let socketIo;

module.exports.connectSocketIo = function (io) {
  socketIo = io;
};


privateRouter.put('/:id', function (req, res, next) {
  const id = req.params.id;
  if (!ObjectId.isValid(id)) {
    return next();
  }

  technicalChallenge
    .findById(id)
    .exec(function (err, dbData) {
      if (err) {
        logger.error(err);
        res.status(400).send({
          msg: 'Could not get data',
          err: err.message,
        });
      } else if (dbData) {
        if (
          !auth.authCompetition(
            req.user,
            dbData.competition,
            ACCESSLEVELS.JUDGE
          )
        ) {
          return res.status(401).send({
            msg: 'You have no authority to access this api!!',
          });
        }

        dbData.score = req.body.score;
        
        dbData.save(function (err) {
          if (err) {
            logger.error(err);
            return res.status(400).send({
              err: err.message,
              msg: 'Could not save data',
            });
          }
          return res.status(200).send({
            msg: 'Saved data',
            score: dbData.score
          });
        });
      }
    });
});

privateRouter.get('/:competitionId/:leagueId', function (req, res, next) {
  const competitionId = req.params.competitionId;
  if (!ObjectId.isValid(competitionId)) {
    return next();
  }
  const leagueId = req.params.leagueId;

  if (
  !auth.authCompetition(
      req.user,
      competitionId,
      ACCESSLEVELS.VIEW
    )
  ) {
    return res.status(401).send({
      msg: 'You have no authority to access this api!!',
    });
  }

  technicalChallenge
    .find({
      competition: competitionId
    })
    .populate({
      path:'team',
      match: {'league': {$eq: leagueId}}
     })
    .exec(function (err, dbData) {
      dbData = dbData.filter(d => d.team != null);
      if (err) {
        logger.error(err);
        res.status(400).send({
          msg: 'Could not get data',
          err: err.message,
        });
      } else if (dbData) {
        return res.status(200).send(dbData);
      }
    });
});



publicRouter.all('*', function (req, res, next) {
  next();
});
privateRouter.all('*', function (req, res, next) {
  next();
});

module.exports.public = publicRouter;
module.exports.private = privateRouter;
module.exports.admin = adminRouter;
