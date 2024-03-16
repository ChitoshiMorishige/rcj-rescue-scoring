//= =======================================================================
//                          Libraries
//= =======================================================================

const express = require('express');

const publicRouter = express.Router();
const privateRouter = express.Router();
const adminRouter = express.Router();
const query = require('../../helper/query-helper');
const { ObjectId } = require('mongoose').Types;
const logger = require('../../config/logger').mainLogger;
const competitiondb = require('../../models/competition');
//= =======================================================================
//                          /maps Api endpoints
//= =======================================================================

publicRouter.get('/', function (req, res) {
  query.doFindResultSortQuery(req, res, null, null, competitiondb.field);
});

publicRouter.get('/:fieldid', function (req, res, next) {
  const id = req.params.fieldid;

  if (!ObjectId.isValid(id)) {
    return next();
  }

  query.doIdQuery(req, res, id, '', competitiondb.field);
});

publicRouter.get('/:fieldid/runs', function (req, res, next) {
  const id = req.params.fieldid;

  if (!ObjectId.isValid(id)) {
    return next();
  }

  competitiondb.run.find({ field: id }, function (err, data) {
    if (err) {
      logger.error(err);
      res.status(400).send({ msg: 'Could not get runs', err: err.message });
    } else {
      res.status(200).send(data);
    }
  });
});

adminRouter.delete('/:fieldid', function (req, res, next) {
  const id = req.params.fieldid;

  if (!ObjectId.isValid(id)) {
    return next();
  }

  competitiondb.field.deleteOne({ _id: id }, function (err) {
    if (err) {
      logger.error(err);
      res.status(400).send({ msg: 'Could not remove field', err: err.message });
    } else {
      res.status(200).send({ msg: 'Field has been removed!' });
    }
  });
});

adminRouter.post('/', function (req, res) {
  const field = req.body;

  const newField = new competitiondb.field({
    name: field.name,
    competition: field.competition
  });

  newField.save(function (err, data) {
    if (err) {
      logger.error(err);
      res.status(400).send({ msg: 'Error saving field', err: err.message });
    } else {
      res.location(`/api/fields/${data._id}`);
      res.status(201).send({ msg: 'New field has been saved', id: data._id });
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
