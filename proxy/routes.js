const express = require('express'),
      router = express.Router(),
      https = require('https'),
      querystring = require('querystring'),
      handlers = require('./handlers'),
      config = require('config');

router.post('/submissions', (req, res) => {
    if (req.headers.authorization == undefined || req.headers['content-type'] == undefined) {
        res.status(401).send({error: "Invalid headers"});
        return;
    } 

    let course = req.body.course;
    let user = req.body.user;
    let isStreakRestored = req.body.streak_restored;
    delete req.body.course;
    delete req.body.user;
    delete req.body.streak_restored;

    if (course == undefined || user == undefined || isNaN(course) || isNaN(user)) {
        res.status(401).send({error: "Invalid course or user"});
        return;
    } 

    if (!config.get('supported_courses').includes(course)) {
        res.status(401).send({error: "Unsupported course"});
        return;
    }

    let body = JSON.stringify(req.body);

    let options = {
        host: 'stepik.org',
        path: '/api/submissions',
        method: req.method,
        headers: {
            'Authorization': req.headers.authorization,
            'Content-Type': req.headers['content-type'],
            'Content-Length': Buffer.byteLength(body)
        }
    }

    let rq = https.request(options, (rs) => {
        var buff = '';
        rs.on('data', (chunk) => {buff += chunk});

        rs.on('end', () => {
            let data = JSON.parse(buff);
            if (data.submissions.length > 0) {
                handlers.postReturn(course, user, data.submissions[0], isStreakRestored).then(insertedSubmission => {
                    console.log(`[OK] Add submission to db: course = ${course}, user = ${user}, id = ${insertedSubmission.id}, exp = ${insertedSubmission.exp}`);
                }).catch((err) => {
                    console.log(`[FAIL] Add submission to db: course = ${course}, user = ${user}, Stepik response = ${buff}, error = ${err}`);
                });

                res.status(rs.statusCode).send(buff);
            } else {
                res.status(401).send({error: "Invalid backend response"});
            }
        });
    });

    rq.write(body);
    rq.end();
});

router.get('/submissions/:id?', (req, res) => {
    if (req.headers.authorization == undefined) {
        res.status(401).send({error: "Invalid headers"});
        return;
    } 

    let options = {
        host: 'stepik.org',
        path: '/api/submissions' + (req.params.id ? '/' + req.params.id : '') + '?' + querystring.stringify(req.query),
        method: req.method,
        headers: {
            'Authorization': req.headers.authorization
        }
    }

    if (req.headers['content-type']) {
        options.headers['Content-Type'] = req.headers['content-type'];
    }

    let rq = https.request(options, (rs) => {
        var buff = '';
        rs.on('data', (chunk) => {buff += chunk});

        rs.on('end', () => {
            let data = JSON.parse(buff);
            if (data.submissions.length > 0) {
                let submission = data.submissions[0];
                handlers.getReturn(submission).then(_ => {
                    console.log(`[OK] Update submission in db: id = ${submission.id}, status = ${submission.status}`);
                }).catch((err) => {
                    console.log(`[FAIL] Update submission in db: Stepik response = ${buff}`);
                });

                res.status(rs.statusCode).send(buff);
            } else {
                res.status(401).send({error: "Invalid backend response"});
            }
        });
    });

    rq.end();
});

router.get('/rating', (req, res) => {
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
});

router.get('/count', (req, res) => {
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

    handlers.getCount(course, delta).then(result => {
        res.send(result);
    }).catch((err) => {
        console.log(`[FAIL] Get rating count from db: error = ${err}`);
        res.status(500).send({error: ""});
    });
});


router.post('/migrate', (req, res) => {
    let course = req.body.course;

    if (course == undefined || isNaN(course)) {
        res.status(401).send({error: "Invalid course id"});
        return;
    } 

    course = Number.parseInt(course);
    if (course != 1838) {
        res.status(401).send({error: "Only 1838 course supported migration"});
        return;
    }

    let user = req.body.user;
    if (user == undefined || isNaN(user)) {
        res.status(401).send({error: "Invalid user id"});
        return;
    } 

    let exp = req.body.exp;
    if (exp == undefined || isNaN(exp) || exp <= 0) {
        res.status(401).send({error: "Invalid exp count"});
        return;
    } 

    let streak = req.body.streak;
    if (streak == undefined || isNaN(streak) || streak < 1) {
        res.status(401).send({error: "Invalid streak count"});
        return;
    } 

    handlers.postMigrate(course, user, exp, streak).then(result => {
        if (!result) {
            console.log(`[OK] Migration completed before: user = ${user}, exp = ${exp}, streak = ${streak}`);
            res.status(200).send({});
        } else {
            console.log(`[OK] Migration completed: user = ${user}, exp = ${exp}, streak = ${streak}`);
            res.status(201).send({});
        }
    }).catch((err) => {
        console.log(`[FAIL] Migration for user = ${user}, error = ${err}`);
        res.status(500).send({error: ""});
    });
});

module.exports = router;
