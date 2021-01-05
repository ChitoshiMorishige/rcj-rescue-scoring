//= =======================================================================
//                          Libraries
//= =======================================================================

const express = require('express');

const superRouter = express.Router();
const validator = require('validator');
const urlDb = require('../../models/shortURL');
const query = require('../../helper/query-helper');
const { ObjectId } = require('mongoose').Types;
const logger = require('../../config/logger').mainLogger;
const auth = require('../../helper/authLevels');
const { ACCESSLEVELS } = require('../../models/user');

superRouter.get('/', function (req, res) {
  urlDb.shortURL
    .find({})
    .lean()
    .exec(function (err, data) {
      if (err) {
        logger.error(err);
        res.status(400).send({
          msg: 'Could not get users',
          err: err.message,
        });
      } else {
        res.status(200).send(data);
      }
    });
});

superRouter.delete('/:shortId', function (req, res, next) {
  const id = req.params.shortId;

  if (!ObjectId.isValid(id)) {
    return next();
  }

  urlDb.shortURL.deleteOne(
    {
      _id: id,
    },
    function (err) {
      if (err) {
        logger.error(err);
        res.status(400).send({
          msg: 'Could not remove url shortening',
          err: err.message,
        });
      } else {
        res.status(200).send({
          msg: 'Setting has been removed!',
        });
      }
    }
  );
});

superRouter.post('/', function (req, res) {
  const set = req.body;

  const newSetting = new urlDb.shortURL({
    name: set.name,
    shorted: set.shorted,
    transfer: set.transfer,
  });

  urlDb.shortURL.findOne(
    {
      name: newSetting.name,
    },
    function (err, dbURL) {
      if (dbURL) {
        dbURL.shorted = newSetting.shorted;
        dbURL.transfer = newSetting.transfer;

        dbURL.save(function (err) {
          if (err) {
            logger.error(err);
            res.status(400).send({
              msg: 'Could not register url shortening :(',
            });
          }
          res.status(200).send({
            msg: 'Setting has been registered!',
          });
        });
      } else {
        newSetting.save(function (err) {
          if (err) {
            logger.error(err);
            res.status(400).send({
              msg: 'Could not register url shortening :(',
            });
          }
          res.status(200).send({
            msg: 'Setting has been registered!',
          });
        });
      }
    }
  );
});

module.exports.super = superRouter;
