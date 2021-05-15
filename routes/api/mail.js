//= =======================================================================
//                          Libraries
//= =======================================================================

const express = require('express');

const publicRouter = express.Router();
const privateRouter = express.Router();
const adminRouter = express.Router();
const validator = require('validator');
const { ObjectId } = require('mongoose').Types;
const pathL = require('path');
const fs = require('fs');
const mime = require('mime');
const nodemailer = require('nodemailer');
const { htmlToText } = require('html-to-text');
const crypto = require('crypto');
const { ACCESSLEVELS } = require('../../models/user');
const auth = require('../../helper/authLevels');
const logger = require('../../config/logger').mainLogger;
const query = require('../../helper/query-helper');
const mailDb = require('../../models/mail');
const sanitizeFilename = require('sanitize-filename');
const {escapeRegExp} = require('lodash');
const competitiondb = require('../../models/competition');


const S = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const N = 32;

const TRANSPARENT_GIF_BUFFER = Buffer.from(
  'R0lGODlhAQABAIABAP///wAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
  'base64'
);

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

let smtp;
if (process.env.MAIL_SMTP &&process.env.MAIL_PORT &&process.env.MAIL_FROM) {
  let smtp_conf;
  if(process.env.MAIL_USER && process.env.MAIL_PASS){
    smtp_conf = {
      host: process.env.MAIL_SMTP,
      port: process.env.MAIL_PORT,
      secure: process.env.MAIL_PORT == 465,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    };
  }else{
    //No auth
    smtp_conf = {
      host: process.env.MAIL_SMTP,
      port: process.env.MAIL_PORT,
      use_authentication: false,
      tls: {
          rejectUnauthorized: false
      }
    };
  }
  smtp = nodemailer.createTransport(smtp_conf);
} else {
  smtp = null;
}

adminRouter.get('/templates', function (req, res, next) {
  const path = `${__dirname}/../../templates/mail/`;
  fs.readdir(path, { withFileTypes: true }, (err, dirents) => {
    if (err) {
      console.error(err);
      return;
    }

    const d = [];
    for (const dirent of dirents) {
      if (!dirent.isDirectory()) {
        const tmp = {
          name: pathL.basename(dirent.name, '.html'),
          path: dirent.name,
        };
        d.push(tmp);
      }
    }
    res.send(d);
  });
});

adminRouter.get('/templates/:fileName', function (req, res, next) {
  const { fileName } = req.params;

  const path = `${__dirname}/../../templates/mail/${sanitizeFilename(fileName)}`;
  fs.stat(path, (err, stat) => {
    // Handle file not found
    if (err !== null && err.code === 'ENOENT') {
      res.status(404).send({
        msg: 'File not found',
      });
      return;
    }

    fs.readFile(path, function (err, data) {
      res.writeHead(200, {
        'Content-Type': mime.getType(path),
      });
      res.end(data);
    });
  });
});

adminRouter.post('/templates/:fileName', function (req, res, next) {
  const { fileName } = req.params;

  const path = `${__dirname}/../../templates/mail/${sanitizeFilename(fileName)}`;
  fs.writeFile(path, req.body.content, function (err) {
    if (err) {
      res.status(404).send({
        msg: 'File could not create',
      });
      return;
    }else{
      res.status(200).send({
        msg: 'Success',
        name: fileName
      });
    }
  });
});

adminRouter.delete('/templates/:fileName', function (req, res, next) {
  const { fileName } = req.params;

  const path = `${__dirname}/../../templates/mail/${sanitizeFilename(fileName)}`;
  fs.unlink(path, function (err) {
    if (err) {
      res.status(404).send({
        msg: 'File could not delete',
      });
      return;
    }else{
      res.status(200).send({
        msg: 'Successfully deleted',
        name: fileName
      });
    }
  });
});

adminRouter.post('/send', function (req, res, next) {
  const teams = req.body;
  if(smtp == null){
    res.status(500).send({
      msg: 'Please check smtp parameters',
    });
    return;
  }

  let count = teams.length;
  let sent = false;

  for (const team of teams) {
    let html = team.mailData.content
      .replace(/\r?\n/g, '')
      .replace(/<p><br><\/p>/g, '<br>')
      .replace(/<\/p><p>/g, '<br>')
      .replace(/<span class="ql-cursor">﻿<\/span>/, '');
    let html4text = html;

    const regexpHref = /(href=)["|'](.*?)["|']+/g;

    const mailId = Array.from(crypto.randomFillSync(new Uint8Array(N)))
      .map((n) => S[n % S.length])
      .join('');

    let match;
    const replacedURL = [];
    while ((match = regexpHref.exec(html)) !== null) {
      if (match[2].indexOf('/api/mail/click/') == -1) {
        const token = Array.from(crypto.randomFillSync(new Uint8Array(N / 4)))
          .map((n) => S[n % S.length])
          .join('');

        html = html.replace(
          new RegExp(escapeRegExp(match[0]), 'g'),
          `href="${req.headers.origin}/api/mail/click/${mailId}/${token}"`
        );
        html4text = html4text.replace(
          new RegExp(escapeRegExp(match[2]), 'g'),
          `${req.headers.origin}/api/mail/click/${mailId}/${token}`
        );

        const tmp = {
          token,
          url: match[2],
        };
        replacedURL.push(tmp);
      }
    }

    const text = htmlToText(html4text, {
      tags: { a: { options: { hideLinkHrefIfSameAsText: true } } },
    });

    html = `${html}<img src="${req.headers.origin}/api/mail/open/${mailId}"/>`;

    const message = {
      from: {
        name: process.env.MAIL_SENDER || 'RoboCupJunior CMS',
        address: process.env.MAIL_FROM,
      },
      to: team.email,
      subject: team.mailData.title,
      html,
      text,
      replyTo: process.env.MAIL_REPLY || process.env.MAIL_FROM
    };

    try {
      smtp.sendMail(message, function (error, info) {
        if (error) {
          logger.error(error.message);
          if (!sent) {
            sent = true;
            res.status(500).send({
              msg: error.message,
            });
          }
        } else {
          const now = Math.floor(new Date().getTime() / 1000);

          const newMail = new mailDb.mail({
            competition: team.competition,
            team: team._id,
            mailId,
            messageId: info.messageId,
            time: now,
            to: team.email,
            subject: team.mailData.title,
            html,
            plain: text,
            status: 0,
            events: [
              {
                time: now,
                event: '== Emails have been sent out. ==',
                user: req.user.username,
              },
            ],
            replacedURL,
          });

          newMail.save(function (err, data) {
            if (err) {
              logger.error(err);
              sent = true;
              res.status(500).send({
                msg: err.message,
              });
            } else {
              count--;
              if (count <= 0 && !sent) {
                sent = true;
                res.status(200).send({
                  msg: 'Emails sent',
                });
              }
            }
          });
        }
      });
    } catch (e) {
      if (!sent) {
        sent = true;
        res.status(500).send({
          msg: e,
        });
      }
      logger.error(e);
    }
  }
});

adminRouter.get('/sent/:competitionId', function (req, res, next) {
  const id = req.params.competitionId;

  if (!ObjectId.isValid(id)) {
    return next();
  }

  if (!auth.authCompetition(req.user, id, ACCESSLEVELS.ADMIN)) {
    return res.status(401).send({
      msg: 'You have no authority to access this api',
    });
  }

  mailDb.mail
    .find({
      competition: id,
    })
    .select('competition mailId messageId status subject team time to')
    .populate('team', 'name league teamCode country email')
    .exec(function (err, dbMail) {
      if (err) {
        logger.error(err);
        return res.status(400).send({
          msg: 'Could not get mails',
          err: err.message,
        });
      }
      return res.status(200).send(dbMail.reverse());
    });
});

adminRouter.get('/sent/:competitionId/:mailId', function (req, res, next) {
  const id = req.params.competitionId;
  const { mailId } = req.params;

  if (!ObjectId.isValid(id)) {
    return next();
  }

  if (!auth.authCompetition(req.user, id, ACCESSLEVELS.ADMIN)) {
    return res.status(401).send({
      msg: 'You have no authority to access this api',
    });
  }

  mailDb.mail
    .findOne({
      competition: id,
      mailId,
    })
    .select('html plain')
    .exec(function (err, dbMail) {
      if (err) {
        logger.error(err);
        return res.status(400).send({
          msg: 'Could not get a mail',
          err: err.message,
        });
      }
      return res.status(200).send({ html: dbMail.html, plain: dbMail.plain });
    });
});

adminRouter.get('/event/:competitionId/:mailId', function (req, res, next) {
  const id = req.params.competitionId;
  const { mailId } = req.params;

  if (!ObjectId.isValid(id)) {
    return next();
  }

  if (!auth.authCompetition(req.user, id, ACCESSLEVELS.ADMIN)) {
    return res.status(401).send({
      msg: 'You have no authority to access this api',
    });
  }

  mailDb.mail
    .findOne({
      competition: id,
      mailId,
    })
    .select('events.time events.event events.user')
    .exec(function (err, dbMail) {
      if (err) {
        logger.error(err);
        return res.status(400).send({
          msg: 'Could not get a mail',
          err: err.message,
        });
      }
      return res.status(200).send(dbMail.events.reverse());
    });
});

publicRouter.get('/click/:mailId/:token', function (req, res, next) {
  const { mailId } = req.params;
  const { token } = req.params;

  mailDb.mail
    .aggregate([
      { $match: { mailId } },
      { $unwind: '$replacedURL' },
      { $match: { 'replacedURL.token': token } },
    ])
    .exec(function (err, data) {
      if (err || !data) {
        logger.error(err);
        res.status(400).send({
          msg: 'Could not get URL Data',
        });
      } else if (data[0]) {
        res.redirect(data[0].replacedURL.url);
        mailDb.mail
          .findById(data[0]._id)
          .select('status events')
          .exec(function (err, data) {
            if (err || !data) {
              logger.error(err);
            } else {
              if (data.status < 2) data.status = 2;
              const now = Math.floor(new Date().getTime() / 1000);
              const tmp = {
                time: now,
                event: 'The link in the email was clicked.',
                user: getIP(req),
              };
              data.events.push(tmp);

              data.save(function (err) {
                if (err) {
                  logger.error(err);
                }
              });
            }
          });
      } else {
        res.status(404);
      }
    });
});

publicRouter.get('/open/:mailId', function (req, res, next) {
  const { mailId } = req.params;

  mailDb.mail
    .findOne({
      mailId,
    })
    .select('status events')
    .exec(function (err, dbMail) {
      if (err) {
        logger.error(err);
        res.status(400).send({
          msg: 'Could not get mail',
          err: err.message,
        });
      } else if (dbMail) {
        res.writeHead(200, { 'Content-Type': 'image/gif' });
        res.end(TRANSPARENT_GIF_BUFFER, 'binary');

        if (dbMail.status < 1) dbMail.status = 1;
        const now = Math.floor(new Date().getTime() / 1000);
        const tmp = {
          time: now,
          event: 'The email was opened.',
          user: getIP(req),
        };
        dbMail.events.push(tmp);
        dbMail.save(function (err) {
          if (err) {
            logger.error(err);
          }
        });
      }
    });
});


adminRouter.get('/mailAuth', function (req, res, next) {

  mailDb.mailAuth
    .find()
    .exec(function (err, dbMail) {
      if (err) {
        logger.error(err);
        return res.status(400).send({
          msg: 'Could not get mails',
          err: err.message,
        });
      }
      return res.status(200).send(dbMail);
    });
});

publicRouter.get('/my/:teamId/:token', function (req, res, next) {
  const teamId = req.params.teamId;
  const token = req.params.token;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team
    .findOne({
      "_id": teamId,
      "document.token": token
    })
    .exec(function (err, team) {
      if (err || team == null) {
        if (!err) err = { message: 'No team found' };
          res.status(400).send({
            msg: 'Could not get team',
            err: err.message,
          });
        } else if (team) {
          mailDb.mail
          .find({
            team: teamId,
          })
          .select('competition mailId messageId subject team time')
          .exec(function (err, dbMail) {
            if (err) {
              logger.error(err);
              return res.status(400).send({
                msg: 'Could not get mails',
                err: err.message,
              });
            }
            return res.status(200).send(dbMail.reverse());
          });
      }
    });
});

publicRouter.get('/get/:teamId/:token/:mailId', function (req, res, next) {
  const teamId = req.params.teamId;
  const token = req.params.token;
  const mailId = req.params.mailId;

  if (!ObjectId.isValid(teamId)) {
    return next();
  }

  competitiondb.team
    .findOne({
      "_id": teamId,
      "document.token": token
    })
    .exec(function (err, team) {
      if (err || team == null) {
        if (!err) err = { message: 'No team found' };
          res.status(400).send({
            msg: 'Could not get team',
            err: err.message,
          });
        } else if (team) {
          mailDb.mail
          .findOne({
            team: teamId,
            mailId,
          })
          .select('html plain')
          .exec(function (err, dbMail) {
            if (err) {
              logger.error(err);
              return res.status(400).send({
                msg: 'Could not get a mail',
                err: err.message,
              });
            }
            return res.status(200).send({ html: dbMail.html, plain: dbMail.plain });
          });
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
