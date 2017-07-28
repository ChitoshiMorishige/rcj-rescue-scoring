// -*- tab-width: 2 -*-
var express = require('express')
var publicRouter = express.Router()
var privateRouter = express.Router()
var adminRouter = express.Router()
var ObjectId = require('mongoose').Types.ObjectId

/* GET home page. */
publicRouter.get('/', function (req, res) {
  res.render('line_home', {user: req.user});
})

publicRouter.get('/:competitionid', function (req, res, next) {
  const id = req.params.competitionid

  if (!ObjectId.isValid(id)) {
    return next()
  }

  res.render('line_competition', {id: id, user: req.user})
})

publicRouter.get('/:competitionid/score', function (req, res, next) {
  const id = req.params.competitionid

  if (!ObjectId.isValid(id)) {
    return next()
  }
  
  res.render('line_score', {id: id, user: req.user, get: req.query})
})


publicRouter.get('/view/:roundid', function (req, res, next) {
  const id = req.params.roundid

  if (!ObjectId.isValid(id)) {
    return next()
  }

  res.render('line_view', {id: id})
})
publicRouter.get('/viewfield', function (req, res, next) {
  const ids = req.query.fields

  res.render('line_view_field', {ids: ids})
})

publicRouter.get('/view/inline/:runid', function (req, res) {
  const id = req.params.runid

  if (!ObjectId.isValid(id)) {
    return next()
  }
  res.render('line_inline_view', {id: id})
})

publicRouter.get('/viewfield/:fieldid', function (req, res, next) {
  const id = req.params.fieldid

  if (!ObjectId.isValid(id)) {
    return next()
  }

  res.render('line_view_field', {id: id})
})

publicRouter.get('/viewcurrent', function (req, res) {
  res.render('line_view_current')
})

privateRouter.get('/judge/:roundid', function (req, res, next) {
  const id = req.params.roundid
  if (!ObjectId.isValid(id)) {
    return next()
  }
  res.render('line_judge', {id: id})
})

privateRouter.get('/sign/:roundid', function (req, res) {
  res.render('line_sign', {id: req.params.roundid})
})

adminRouter.get('/approval/:roundid', function (req, res) {
  const id = req.params.roundid

  if (!ObjectId.isValid(id)) {
    return next()
  }

  res.render('line_approval', {id: id})
})

adminRouter.get('/editor', function (req, res) {
  res.render('line_editor')
})

adminRouter.get('/editor/:mapid', function (req, res, next) {
  const id = req.params.mapid

  if (!ObjectId.isValid(id)) {
    return next()
  }

  res.render('line_editor', {mapid: id})
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
