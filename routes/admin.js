// -*- tab-width: 2 -*-
const ObjectId = require('mongoose').Types.ObjectId
const express = require('express')
const router = express.Router()

/* GET home page. */
router.get('/', function (req, res) {
  res.render('admin_home', {user: req.user})
})

router.get('/:competitionid', function (req, res, next) {
  const id = req.params.competitionid
  
  if (!ObjectId.isValid(id)) {
    return next()
  }
  
  res.render('competition_admin', {id: id, user: req.user})
})

router.get('/:competitionid/teams', function (req, res, next) {
  const id = req.params.competitionid
  
  if (!ObjectId.isValid(id)) {
    return next()
  }
  
  res.render('team_admin', {id: id, user: req.user})
})

router.get('/:competitionid/teams/bulk', function (req, res, next) {
  const id = req.params.competitionid
  
  if (!ObjectId.isValid(id)) {
    return next()
  }
  
  res.render('team_bulk', {id: id, user: req.user})
})

router.get('/:competitionid/line/runs', function (req, res, next) {
  const id = req.params.competitionid
  
  if (!ObjectId.isValid(id)) {
    return next()
  }
  
  res.render('line_run_admin', {id: id, user: req.user})
})

router.get('/:competitionid/line/runs/monitor', function (req, res, next) {
  const id = req.params.competitionid
  
  if (!ObjectId.isValid(id)) {
    return next()
  }
  
  res.render('line_runs_monitor', {id: id, user: req.user})
})

router.get('/:competitionid/maze/runs/monitor', function (req, res, next) {
  const id = req.params.competitionid
  
  if (!ObjectId.isValid(id)) {
    return next()
  }
  
  res.render('maze_runs_monitor', {id: id, user: req.user})
})

router.get('/:competitionid/line/runs/bulk', function (req, res, next) {
  const id = req.params.competitionid
  
  if (!ObjectId.isValid(id)) {
    return next()
  }
  
  res.render('line_run_bulk', {id: id, user: req.user})
})

router.get('/:competitionid/maze/runs/bulk', function (req, res, next) {
  const id = req.params.competitionid
  
  if (!ObjectId.isValid(id)) {
    return next()
  }
  
  res.render('maze_run_bulk', {id: id, user: req.user})
})

router.get('/:competitionid/line/maps', function (req, res, next) {
  const id = req.params.competitionid
  
  if (!ObjectId.isValid(id)) {
    return next()
  }
  
  res.render('line_map_admin', {id: id, user: req.user})
})

router.get('/:competitionid/maze/runs', function (req, res, next) {
  const id = req.params.competitionid
  
  if (!ObjectId.isValid(id)) {
    return next()
  }
  
  res.render('maze_run_admin', {id: id, user: req.user})
})

router.get('/:competitionid/maze/maps', function (req, res, next) {
  const id = req.params.competitionid
  
  if (!ObjectId.isValid(id)) {
    return next()
  }
  
  res.render('maze_map_admin', {id: id, user: req.user})
})

router.get('/:competitionid/maze/editor', function (req, res, next) {
  const id = req.params.competitionid
  
  if (!ObjectId.isValid(id)) {
    return next()
  }
  
  res.render('maze_editor', {compid: id, user: req.user})
})

router.get('/:competitionid/rounds', function (req, res, next) {
  const id = req.params.competitionid
  
  if (!ObjectId.isValid(id)) {
    return next()
  }
  
  res.render('round_admin', {id: id, user: req.user})
})

router.get('/:competitionid/line/editor', function (req, res, next) {
  const id = req.params.competitionid
  
  if (!ObjectId.isValid(id)) {
    return next()
  }
  
  res.render('line_editor', {compid: id, user: req.user})
})

router.get('/:competitionid/fields', function (req, res, next) {
  const id = req.params.competitionid
  
  if (!ObjectId.isValid(id)) {
    return next()
  }
  
  res.render('field_admin', {id: id, user: req.user})
})

router.get('/line/tilesets', function (req, res, next) {
  res.render('tileset_admin')
})

module.exports = router
