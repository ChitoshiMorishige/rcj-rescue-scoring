//= =======================================================================
//                          Libraries
//= =======================================================================

const express = require('express');

const publicRouter = express.Router();
const privateRouter = express.Router();
const adminRouter = express.Router();
const validator = require('validator');
const async = require('async');
const { ObjectId } = require('mongoose').Types;
const multer = require('multer');
const path = require('path');
const mkdirp = require('mkdirp');
const jsonfile = require('jsonfile');
const auth = require('../../helper/authLevels');
var fs = require('fs-extra');
const gracefulFs = require('graceful-fs');

var fs = gracefulFs.gracefulify(fs);
const mime = require('mime');
const filetype = require('file-type');
const { ACCESSLEVELS } = require('../../models/user');
const crypto = require('crypto');
const glob = require('glob');
const ffmpeg = require('fluent-ffmpeg');
const { time } = require('console');

const competitiondb = require('../../models/competition');
const { LEAGUES_JSON } = competitiondb;
const { LEAGUES } = competitiondb;

const dateformat = require('dateformat');
let read = require('fs-readdir-recursive');
const logger = require('../../config/logger').mainLogger;
const query = require('../../helper/query-helper');
const documentDb = require('../../models/document');
const escape = require('escape-html');
const sanitize = require("sanitize-filename");

read = gracefulFs.gracefulify(read);

const S = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const N = 32;

function getIP(req) {
  if (req.headers['x-forwarded-for']) {
    return req.headers['x-forwarded-for'];
  }
  if (req.connection && req.connection.remoteAddress) {
    return req.connection.remoteAddress;
  }
  if (req.connection.socket && req.connection.socket.remoteAddress) {
    return req.connection.socket.remoteAddress;
  }
  if (req.socket && req.socket.remoteAddress) {
    return req.socket.remoteAddress;
  }
  return '0.0.0.0';
}

function writeLog(req, competitionId, teamId, message) {
  const output = `[${dateformat(new Date(), 'mm/dd/yy HH:MM:ss')}] ${getIP(
    req
  )} : ${message}\n`;
  fs.appendFile(
    `${__dirname}/../../documents/${competitionId}/${teamId}/log.txt`,
    output,
    (err) => {
      if (err) logger.error(err.message);
    }
  );
}

publicRouter.get('/answer/:teamId/:token', function (req, res, next) {
  const { teamId } = req.params;
  const { token } = req.params;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team
    .findOne({
      _id: ObjectId(teamId),
      $or: [{ 'document.token': token }, { 'document.public': true }],
    })
    .populate('competition')
    .select('competition document.answers document.enabled')
    .exec(function (err, dbTeam) {
      if (err || dbTeam == null) {
        if (!err) err = { message: 'No team found' };
        res.status(400).send({
          msg: 'Could not get team',
          err: err.message,
        });
      } else if (dbTeam) {
        if (
          (dbTeam.competition.documents.enable && dbTeam.document.enabled) ||
          auth.authCompetition(
            req.user,
            dbTeam.competition._id,
            ACCESSLEVELS.VIEW
          )
        ) {
          res.send(dbTeam.document.answers);
        } else {
          res.status(401).send({
            msg: 'Operation not permited',
          });
        }
      }
    });
});

publicRouter.put('/answer/:teamId/:token', function (req, res, next) {
  const { teamId } = req.params;
  const { token } = req.params;
  const answer = req.body;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team
    .findOne({
      _id: ObjectId(teamId),
      'document.token': token,
    })
    .populate('competition')
    .select('competition document.answers document.deadline document.enabled')
    .exec(function (err, dbTeam) {
      if (err || dbTeam == null) {
        if (!err) err = { message: 'No team found' };
        res.status(400).send({
          msg: 'Could not get team',
          err: err.message,
        });
      } else if (dbTeam) {
        const userAuth = auth.authCompetition(
          req.user,
          dbTeam.competition._id,
          ACCESSLEVELS.JUDGE
        );
        if (
          (dbTeam.competition.documents.enable && dbTeam.document.enabled) ||
          userAuth
        ) {
          const teamDeadline = dbTeam.document.deadline;
          let { deadline } = dbTeam.competition.documents;
          if (teamDeadline != null) deadline = teamDeadline;

          const now = new Date();
          const timestamp = Math.floor(now.getTime() / 1000);

          if (deadline >= timestamp || userAuth) {
            dbTeam.document.answers = answer;
            dbTeam.save(function (err) {
              if (err) {
                logger.error(err);
                writeLog(
                  req,
                  dbTeam.competition._id,
                  dbTeam._id,
                  `ERROR: ${err.message}`
                );
                return res.status(400).send({
                  err: err.message,
                  msg: 'Could not save changes',
                });
              }
              writeLog(
                req,
                dbTeam.competition._id,
                dbTeam._id,
                'Submissions have been updated'
              );
              return res.status(200).send({
                msg: 'Saved changes',
              });
            });
          } else {
            writeLog(
              req,
              dbTeam.competition._id,
              dbTeam._id,
              'They  have attempted to update the submission, but it has expired the deadline.'
            );
            res.status(400).send({
              msg: 'The deadline has passed.',
            });
          }
        } else {
          writeLog(
            req,
            dbTeam.competition._id,
            dbTeam._id,
            'They have attempted to update the submission, but this operation is not allowed.'
          );
          res.status(401).send({
            msg: 'Operation not permited',
          });
        }
      }
    });
});

publicRouter.post('/files/:teamId/:token/:fileName', function (req, res, next) {
  const { teamId } = req.params;
  const { token } = req.params;
  const { fileName } = req.params;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team
    .findOne({
      _id: ObjectId(teamId),
      'document.token': token,
    })
    .populate('competition')
    .select('competition document.deadline document.enabled')
    .exec(function (err, dbTeam) {
      if (err || dbTeam == null) {
        if (!err) err = { message: 'No team found' };
        res.status(400).send({
          msg: 'Could not get team',
          err: err.message,
        });
      } else if (dbTeam) {
        const userAuth = auth.authCompetition(
          req.user,
          dbTeam.competition._id,
          ACCESSLEVELS.JUDGE
        );
        if (
          (dbTeam.competition.documents.enable && dbTeam.document.enabled) ||
          userAuth
        ) {
          const teamDeadline = dbTeam.document.deadline;
          let { deadline } = dbTeam.competition.documents;
          if (teamDeadline != null) deadline = teamDeadline;

          const now = new Date();
          const timestamp = Math.floor(now.getTime() / 1000);

          if (deadline >= timestamp || userAuth) {
            glob.glob(
              `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/${sanitize(fileName)}.*`,
              function (er, files) {
                let i = files.length;
                if (i == 0) {
                  upload_process();
                  return;
                }
                fs.mkdir(
                  `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/trash`,
                  (err) => {
                    files.forEach(function (file) {
                      fs.rename(
                        file,
                        `${path.dirname(file)}/trash/${
                          new Date().getTime() / 1000
                        }${path.extname(file)}`,
                        function (err) {
                          if (err) logger.error(err.message);
                          i--;
                          if (i <= 0) {
                            upload_process();
                          }
                        }
                      );
                    });
                  }
                );

                function upload_process() {
                  let originalname = '';
                  const storage = multer.diskStorage({
                    destination(req, file, callback) {
                      callback(
                        null,
                        `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}`
                      );
                    },
                    filename(req, file, callback) {
                      originalname = file.originalname;
                      callback(null, fileName + path.extname(originalname));
                    },
                  });

                  const upload = multer({
                    storage,
                  }).single('file');

                  upload(req, res, function (err) {
                    res.status(200).send({
                      msg: 'File is uploaded',
                    });
                    const ft = mime.getType(originalname);

                    if (ft.includes('video')) {
                      const filepath = `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/${sanitize(fileName)}`;
                      fs.unlink(`${filepath}-thumbnail.png`, function (err) {
                        try {
                          const original = ffmpeg(
                            filepath + path.extname(originalname)
                          );

                          original
                            .screenshots({
                              count: 1,
                              folder: `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}`,
                              filename: `${sanitize(fileName)}-thumbnail.png`,
                              size: '640x?',
                            })
                            .on('error', function (err) {
                              console.log(`an error happened: ${err.message}`);
                            });

                          if (ft != 'video/mp4') {
                            original
                              .output(`${filepath}.mp4`)
                              .on('error', function (err) {
                                console.log(
                                  `an error happened: ${err.message}`
                                );
                              });
                          }
                        } catch (err) {}
                      });
                    }
                    writeLog(
                      req,
                      dbTeam.competition._id,
                      dbTeam._id,
                      `File uploaded! File name: ${sanitize(fileName)}`
                    );
                  });
                }
              }
            );
          } else {
            res.status(400).send({
              msg: 'The deadline has passed.',
            });
            writeLog(
              req,
              dbTeam.competition._id,
              dbTeam._id,
              `They have attempted to upload a file, but it has expired the deadline. File name: ${sanitize(fileName)}`
            );
          }
        } else {
          res.status(401).send({
            msg: 'Operation not permited',
          });
          writeLog(
            req,
            dbTeam.competition._id,
            dbTeam._id,
            `They have attempted to upload a file, but this operation is not allowed. File name: ${sanitize(fileName)}`
          );
        }
      }
    });
});

publicRouter.get('/files/:teamId/:token', function (req, res, next) {
  const { teamId } = req.params;
  const { token } = req.params;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team
    .findOne({
      _id: ObjectId(teamId),
      $or: [{ 'document.token': token }, { 'document.public': true }],
    })
    .populate('competition')
    .select('competition document.enabled')
    .exec(function (err, dbTeam) {
      if (err || dbTeam == null) {
        if (!err) err = { message: 'No team found' };
        res.status(400).send({
          msg: 'Could not get team',
          err: err.message,
        });
      } else if (dbTeam) {
        if (
          (dbTeam.competition.documents.enable && dbTeam.document.enabled) ||
          auth.authCompetition(
            req.user,
            dbTeam.competition._id,
            ACCESSLEVELS.VIEW
          )
        ) {
          const path = `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}`;
          fs.readdir(path, { withFileTypes: true }, (err, dirents) => {
            if (err) {
              console.error(err);
              return;
            }

            const d = [];
            for (const dirent of dirents) {
              if (!dirent.isDirectory()) {
                d.push(escape(dirent.name));
              }
            }
            res.send(d);
          });
        } else {
          res.status(401).send({
            msg: 'Operation not permited',
          });
        }
      }
    });
});

publicRouter.get('/files/:teamId/:token/:fileName', function (req, res, next) {
  const { teamId } = req.params;
  const { token } = req.params;
  const { fileName } = req.params;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team
    .findOne({
      _id: ObjectId(teamId),
      $or: [{ 'document.token': token }, { 'document.public': true }],
    })
    .populate('competition')
    .select('competition document.enabled')
    .exec(function (err, dbTeam) {
      if (err || dbTeam == null) {
        if (!err) err = { message: 'No team found' };
        res.status(400).send({
          msg: 'Could not get team',
          err: err.message,
        });
      } else if (dbTeam) {
        if (
          (dbTeam.competition.documents.enable && dbTeam.document.enabled) ||
          auth.authCompetition(
            req.user,
            dbTeam.competition._id,
            ACCESSLEVELS.VIEW
          )
        ) {
          const path = `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/${sanitize(fileName)}`;
          fs.stat(path, (err, stat) => {
            // Handle file not found
            if (err !== null && err.code === 'ENOENT') {
              res.status(404).send({
                msg: 'File not found',
              });
              return;
            }

            // Streaming Video
            if (mime.getType(path).includes('video')) {
              try {
                const fileSize = stat.size;
                const { range } = req.headers;

                if (range) {
                  const parts = range.replace(/bytes=/, '').split('-');

                  const start = parseInt(parts[0], 10);
                  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

                  const chunksize = end - start + 1;
                  const file = fs.createReadStream(path, { start, end });
                  file.on('error', function (err) {
                    logger.error(err.message);
                  });
                  const head = {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': mime.getType(path),
                  };

                  res.writeHead(206, head);
                  file.pipe(res);
                  return;
                }
                const head = {
                  'Content-Length': fileSize,
                  'Content-Type': mime.getType(path),
                };

                res.writeHead(200, head);
                fs.createReadStream(path).pipe(res);
                return;
              } catch (err) {
                logger.error(err.message);
              }
            } else {
              fs.readFile(path, function (err, data) {
                res.writeHead(200, {
                  'Content-Type': mime.getType(path),
                });
                res.end(data);
              });
            }
          });
        } else {
          res.status(401).send({
            msg: 'Operation not permited',
          });
        }
      }
    });
});

/// / for reviwer & admin

privateRouter.get('/review/:teamId', function (req, res, next) {
  const { teamId } = req.params;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team.findById(teamId).exec(function (err, dbTeam) {
    if (err) {
      if (!err) err = { message: 'No team found' };
      res.status(400).send({
        msg: 'Could not get team',
        err: err.message,
      });
    } else if (dbTeam) {
      if (
        auth.authCompetition(req.user, dbTeam.competition, ACCESSLEVELS.VIEW)
      ) {
        documentDb.review
          .find({
            team: teamId,
          })
          .populate('reviewer', 'username')
          .populate('team', 'competition')
          .exec(function (err, dbReview) {
            if (err) {
              if (!err) err = { message: 'No review found' };
              res.status(400).send({
                msg: 'Could not get review',
                err: err.message,
              });
            } else if (dbReview) {
              res.send(dbReview);
            }
          });
      } else {
        res.status(401).send({
          msg: 'Operation not permited',
        });
      }
    } else {
      res.status(400).send({
        msg: 'Could not get team',
        err: 'No team found',
      });
    }
  });
});

adminRouter.get('/reviews/:competition', function (req, res, next) {
  const { competition } = req.params;

  if (!ObjectId.isValid(competition)) {
    return next();
  }

  if (auth.authCompetition(req.user, competition, ACCESSLEVELS.ADMIN)) {
    documentDb.review
      .find({
        competition
      })
      .populate('reviewer', 'username')
      .populate('team', 'league')
      .exec(function (err, dbReview) {
        if (err) {
          if (!err) err = { message: 'No review found' };
          res.status(400).send({
            msg: 'Could not get review',
            err: err.message,
          });
        } else if (dbReview) {
          res.send(dbReview);
        }
      });
  } else {
    res.status(401).send({
      msg: 'Operation not permited',
    });
  }
});

privateRouter.put('/review/:teamId', function (req, res, next) {
  const { teamId } = req.params;
  const comments = req.body;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team.findById(teamId).exec(function (err, dbTeam) {
    if (err) {
      if (!err) err = { message: 'No team found' };
      res.status(400).send({
        msg: 'Could not get team',
        err: err.message,
      });
    } else if (dbTeam) {
      if (
        auth.authCompetition(req.user, dbTeam.competition, ACCESSLEVELS.JUDGE)
      ) {
        documentDb.review
          .findOne({
            team: teamId,
            reviewer: req.user._id,
          })
          .exec(function (err, dbReview) {
            if (err) {
              if (!err) err = { message: 'No team found' };
              res.status(400).send({
                msg: 'Could not get team',
                err: err.message,
              });
            } else if (dbReview) {
              dbReview.comments = comments;
              dbReview.save(function (err) {
                if (err) {
                  logger.error(err);
                  return res.status(400).send({
                    err: err.message,
                    msg: 'Could not save changes',
                  });
                }
                writeLog(
                  req,
                  dbTeam.competition,
                  dbTeam._id,
                  `Reviewer: ${req.user.username}'s comment has been updated`
                );
                return res.status(200).send({
                  msg: 'Saved changes',
                });
              });
            } else {
              const newReview = new documentDb.review({
                team: teamId,
                competition: dbTeam.competition,
                reviewer: req.user._id,
                comments,
              });

              newReview.save(function (err, data) {
                if (err) {
                  logger.error(err);
                  res.status(500).send({
                    msg: err.message,
                  });
                } else {
                  writeLog(
                    req,
                    dbTeam.competition,
                    dbTeam._id,
                    `Reviewer: ${req.user.username}'s comment has been created`
                  );
                  return res.status(200).send({
                    msg: 'Saved changes',
                  });
                }
              });
            }
          });
      } else {
        res.status(401).send({
          msg: 'Operation not permited',
        });
      }
    } else {
      res.status(400).send({
        msg: 'Could not get team',
        err: 'No team found',
      });
    }
  });
});



privateRouter.post(
  '/review/files/:teamId/:fileName',
  function (req, res, next) {
    const { teamId } = req.params;
    const { fileName } = req.params;

    if (!ObjectId.isValid(teamId)) {
      return next();
    }

    competitiondb.team
      .findById(teamId)
      .select('competition')
      .exec(function (err, dbTeam) {
        if (err || dbTeam == null) {
          if (!err) err = { message: 'No team found' };
          res.status(400).send({
            msg: 'Could not get team',
            err: err.message,
          });
        } else if (dbTeam) {
          const userAuth = auth.authCompetition(
            req.user,
            dbTeam.competition,
            ACCESSLEVELS.JUDGE
          );
          if (userAuth) {
            fs.mkdirs(
              `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/review/${req.user.username}`,
              (err) => {
                glob.glob(
                  `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/review/${req.user.username}/${sanitize(fileName)}.*`,
                  function (er, files) {
                    let i = files.length;
                    if (i == 0) {
                      upload_process();
                      return;
                    }
                    fs.mkdir(
                      `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/trash`,
                      (err) => {
                        files.forEach(function (file) {
                          fs.rename(
                            file,
                            `${path.dirname(file)}/../../trash/${
                              new Date().getTime() / 1000
                            }${path.extname(file)}`,
                            function (err) {
                              if (err) logger.error(err.message);
                              i--;
                              if (i <= 0) {
                                upload_process();
                              }
                            }
                          );
                        });
                      }
                    );

                    function upload_process() {
                      let originalname = '';
                      const storage = multer.diskStorage({
                        destination(req, file, callback) {
                          callback(
                            null,
                            `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/review/${req.user.username}`
                          );
                        },
                        filename(req, file, callback) {
                          originalname = file.originalname;
                          callback(null, fileName + path.extname(originalname));
                        },
                      });

                      const upload = multer({
                        storage,
                      }).single('file');

                      upload(req, res, function (err) {
                        res.status(200).send({
                          msg: 'File is uploaded',
                        });
                        const ft = mime.getType(originalname);

                        if (ft.includes('video')) {
                          const filepath = `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/review/${req.user.username}/${sanitize(fileName)}`;
                          fs.unlink(
                            `${filepath}-thumbnail.png`,
                            function (err) {
                              try {
                                const original = ffmpeg(
                                  filepath + path.extname(originalname)
                                );

                                original
                                  .screenshots({
                                    count: 1,
                                    folder: `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/review/${req.user.username}`,
                                    filename: `${sanitize(fileName)}-thumbnail.png`,
                                    size: '640x?',
                                  })
                                  .on('error', function (err) {
                                    console.log(
                                      `an error happened: ${err.message}`
                                    );
                                  });

                                if (ft != 'video/mp4') {
                                  original
                                    .output(`${filepath}.mp4`)
                                    .on('error', function (err) {
                                      console.log(
                                        `an error happened: ${err.message}`
                                      );
                                    });
                                }
                              } catch (err) {}
                            }
                          );
                        }
                        writeLog(
                          req,
                          dbTeam.competition._id,
                          dbTeam._id,
                          `Reviewer: ${req.user.username}  File uploaded! File name: ${sanitize(fileName)}`
                        );
                      });
                    }
                  }
                );
              }
            );
          } else {
            res.status(401).send({
              msg: 'Operation not permited',
            });
          }
        }
      });
  }
);

privateRouter.get('/review/files/:teamId', function (req, res, next) {
  const { teamId } = req.params;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team
    .findById(teamId)
    .select('competition')
    .exec(function (err, dbTeam) {
      if (err || dbTeam == null) {
        if (!err) err = { message: 'No team found' };
        res.status(400).send({
          msg: 'Could not get team',
          err: err.message,
        });
      } else if (dbTeam) {
        if (
          auth.authCompetition(req.user, dbTeam.competition, ACCESSLEVELS.VIEW)
        ) {
          const path = `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/review`;

          const files = read(path);
          for (let i = 0; i < files.length; i++) {
            files[i] = files[i].replace('\\', '/');
          }
          res.send(files);
        } else {
          res.status(401).send({
            msg: 'Operation not permited',
          });
        }
      }
    });
});

privateRouter.get(
  '/review/files/:teamId/:userName/:fileName',
  function (req, res, next) {
    const { teamId } = req.params;
    const { userName } = req.params;
    const { fileName } = req.params;

    if (!ObjectId.isValid(teamId)) {
      return next();
    }

    competitiondb.team
      .findById(teamId)
      .select('competition')
      .exec(function (err, dbTeam) {
        if (err || dbTeam == null) {
          if (!err) err = { message: 'No team found' };
          res.status(400).send({
            msg: 'Could not get team',
            err: err.message,
          });
        } else if (dbTeam) {
          if (
            auth.authCompetition(
              req.user,
              dbTeam.competition,
              ACCESSLEVELS.VIEW
            )
          ) {
            const path = `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/review/${userName}/${sanitize(fileName)}`;
            fs.stat(path, (err, stat) => {
              // Handle file not found
              if (err !== null && err.code === 'ENOENT') {
                res.status(404).send({
                  msg: 'File not found',
                });
                return;
              }

              // Streaming Video
              if (mime.getType(path).includes('video')) {
                try {
                  const fileSize = stat.size;
                  const { range } = req.headers;

                  if (range) {
                    const parts = range.replace(/bytes=/, '').split('-');

                    const start = parseInt(parts[0], 10);
                    const end = parts[1]
                      ? parseInt(parts[1], 10)
                      : fileSize - 1;

                    const chunksize = end - start + 1;
                    const file = fs.createReadStream(path, { start, end });
                    file.on('error', function (err) {
                      logger.error(err.message);
                    });
                    const head = {
                      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                      'Accept-Ranges': 'bytes',
                      'Content-Length': chunksize,
                      'Content-Type': mime.getType(path),
                    };

                    res.writeHead(206, head);
                    file.pipe(res);
                    return;
                  }
                  const head = {
                    'Content-Length': fileSize,
                    'Content-Type': mime.getType(path),
                  };

                  res.writeHead(200, head);
                  fs.createReadStream(path).pipe(res);
                  return;
                } catch (err) {
                  logger.error(err.message);
                }
              } else {
                fs.readFile(path, function (err, data) {
                  res.writeHead(200, {
                    'Content-Type': mime.getType(path),
                  });
                  res.end(data);
                });
              }
            });
          } else {
            res.status(401).send({
              msg: 'Operation not permited',
            });
          }
        }
      });
  }
);

// Inspection
privateRouter.post(
  '/inspection/files/:teamId/:fileName',
  function (req, res, next) {
    const { teamId } = req.params;
    const { fileName } = req.params;

    if (!ObjectId.isValid(teamId)) {
      return next();
    }

    competitiondb.team
      .findById(teamId)
      .select('competition')
      .exec(function (err, dbTeam) {
        if (err || dbTeam == null) {
          if (!err) err = { message: 'No team found' };
          res.status(400).send({
            msg: 'Could not get team',
            err: err.message,
          });
        } else if (dbTeam) {
          const userAuth = auth.authCompetition(
            req.user,
            dbTeam.competition,
            ACCESSLEVELS.JUDGE
          );
          if (userAuth) {
            fs.mkdirs(
              `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/review/inspection`,
              (err) => {
                glob.glob(
                  `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/review/inspection/${sanitize(fileName)}.*`,
                  function (er, files) {
                    let i = files.length;
                    if (i == 0) {
                      upload_process();
                      return;
                    }
                    fs.mkdir(
                      `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/trash`,
                      (err) => {
                        files.forEach(function (file) {
                          fs.rename(
                            file,
                            `${path.dirname(file)}/../../trash/${
                              new Date().getTime() / 1000
                            }${path.extname(file)}`,
                            function (err) {
                              if (err) logger.error(err.message);
                              i--;
                              if (i <= 0) {
                                upload_process();
                              }
                            }
                          );
                        });
                      }
                    );

                    function upload_process() {
                      let originalname = '';
                      const storage = multer.diskStorage({
                        destination(req, file, callback) {
                          callback(
                            null,
                            `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/review/inspection`
                          );
                        },
                        filename(req, file, callback) {
                          originalname = file.originalname;
                          callback(null, fileName + path.extname(originalname));
                        },
                      });

                      const upload = multer({
                        storage,
                      }).single('file');

                      upload(req, res, function (err) {
                        res.status(200).send({
                          msg: 'File is uploaded',
                        });
                      });
                    }
                  }
                );
              }
            );
          } else {
            res.status(401).send({
              msg: 'Operation not permited',
            });
          }
        }
      });
  }
);

privateRouter.get(
  '/inspection/files/:teamId/:fileName',
  function (req, res, next) {
    const { teamId } = req.params;
    const { fileName } = req.params;

    if (!ObjectId.isValid(teamId)) {
      return next();
    }

    competitiondb.team
      .findById(teamId)
      .select('competition')
      .exec(function (err, dbTeam) {
        if (err || dbTeam == null) {
          if (!err) err = { message: 'No team found' };
          res.status(400).send({
            msg: 'Could not get team',
            err: err.message,
          });
        } else if (dbTeam) {
          if (
            auth.authCompetition(
              req.user,
              dbTeam.competition,
              ACCESSLEVELS.JUDGE
            )
          ) {
            glob.glob(
              `${__dirname}/../../documents/${dbTeam.competition._id}/${teamId}/review/inspection/${sanitize(fileName)}.*`,
              function (er, files) {
                const i = files.length;
                if (i == 1) {
                  fs.readFile(files[0], function (err, data) {
                    res.writeHead(200, {
                      'Content-Type': mime.getType(path),
                    });
                    res.end(data);
                  });
                } else {
                  // Handle file not found
                  const path = `${__dirname}/../../public/images/NoImage.png`;
                  fs.readFile(path, function (err, data) {
                    res.writeHead(200, {
                      'Content-Type': 'image/png',
                    });
                    res.end(data);
                  });
                }
              }
            );
          } else {
            res.status(401).send({
              msg: 'Operation not permited',
            });
          }
        }
      });
  }
);

// Templates
adminRouter.get('/templates/documentForm', function (req, res, next) {
  const dir_path = `${__dirname}/../../templates/documentForm/`;
  fs.readdir(dir_path, { withFileTypes: true }, (err, dirents) => {
    if (err) {
      console.error(err);
      return;
    }

    const d = [];
    for (const dirent of dirents) {
      if (!dirent.isDirectory()) {
        const tmp = {
          name: escape(path.basename(dirent.name, '.json')),
          path: escape(dirent.name),
        };
        d.push(tmp);
      }
    }
    res.send(d);
  });
});

adminRouter.get('/templates/documentForm/:fileName', function (req, res, next) {
  const { fileName } = req.params;

  const dir_path = `${__dirname}/../../templates/documentForm/${sanitize(fileName)}`;
  fs.stat(dir_path, (err, stat) => {
    // Handle file not found
    if (err !== null && err.code === 'ENOENT') {
      res.status(404).send({
        msg: 'File not found',
      });
      return;
    }

    fs.readFile(dir_path, function (err, data) {
      res.writeHead(200, {
        'Content-Type': mime.getType(dir_path),
      });
      res.end(data);
    });
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
