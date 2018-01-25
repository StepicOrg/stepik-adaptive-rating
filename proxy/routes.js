const express = require('express'),
      router = express.Router(),
      https = require('https'),
      handlers = require('./handlers'),
      config = require('config');

router.put('/rating', (req, res) => {
    try {
        let token = req.body.token;
        let course = req.body.course;
        let exp = req.body.exp;

        if (!token) {
            res.status(401).send({error: "Invalid token"});
            return;
        }

        if (course == undefined || isNaN(course)) {
            res.status(401).send({error: "Invalid course id"});
            return;
        }

        course = Number.parseInt(course);
        if (!config.get('supported_courses').includes(course)) {
            res.status(401).send({error: "Unsupported course"});
            return;
        }

        if (exp == undefined || isNaN(exp)) {
            res.status(401).send({error: "Invalid exp"});
            return;
        }

        handlers.putRating(course, exp, token).then(_ => {
            console.log(`[OK] Update rating: course = ${course}, token = ${token}, exp = ${exp}`);
            res.status(200).send({});
        }).catch(err => {
            console.log(`[FAIL] Update rating: error = ${err}`);
            res.status(500).send({error: ""});
        });
    } catch (err) {
        console.log(`[FATAL ERROR] Update rating: fatal error = ${err}`);
        res.status(500).send({error: ""});
    }
});

router.get('/rating', (req, res) => {
    try {
        let course = req.query.course;

        if (course == undefined || isNaN(course)) {
            res.status(401).send({error: "Invalid course id"});
            return;
        }

        course = Number.parseInt(course);
        if (!config.get('supported_courses').includes(course)) {
            res.status(401).send({error: "Unsupported course"});
            return;
        }

        let delta = Number.parseInt(req.query.days) || 0;
        if (!config.get('supported_days').includes(delta)) {
            res.status(401).send({error: "Unsupported days count"});
            return;
        }

        let count = Number.parseInt(req.query.count) || 10;
        let user = req.query.user || undefined;

        handlers.getRating(course, count, delta, user).then(result => {
            res.send(result);
        }).catch((err) => {
            console.log(`[FAIL] Get rating from db: error = ${err}`);
            res.status(500).send({error: ""});
        });
    } catch (err) {
        console.log(`[FATAL ERROR] Get rating from db: error = ${err}`);
        res.status(500).send({error: ""});
    }
});

router.get('/rating-restore', (req, res) => {
    try {
        let token = req.query.token;
        let course = req.query.course;

        if (!token) {
            res.status(401).send({error: "Invalid token"});
            return;
        }

        if (course == undefined || isNaN(course)) {
            res.status(401).send({error: "Invalid course id"});
            return;
        }

        course = Number.parseInt(course);
        if (!config.get('supported_courses').includes(course)) {
            res.status(401).send({error: "Unsupported course"});
            return;
        }

        handlers.restoreRating(course, token).then(result => {
            console.log(`[OK] Restore rating: course = ${course}, token = ${token}`);
            res.status(200).send(result);
        }).catch(err => {
            console.log(`[FAIL] Update rating: error = ${err}`);
            res.status(500).send({error: ""});
        });
    } catch (err) {
        console.log(`[FATAL ERROR] Restore rating from db: error = ${err}`);
        res.status(500).send({error: ""});
    }
});

module.exports = router;
