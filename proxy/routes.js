const express = require('express'),
      router = express.Router(),
      https = require('https'),
      querystring = require('querystring'),
      handlers = require('./handlers');

router.post('/submissions', (req, res) => {
    if (req.headers.authorization == undefined || req.headers['content-type'] == undefined) {
        res.send({error: "Invalid headers"}).status(401);
        return;
    } 

    let course = req.body.course;
    let user = req.body.user;
    delete req.body.course;
    delete req.body.user;

    if (course == undefined || user == undefined || isNaN(course) || isNaN(user)) {
        res.send({error: "Invalid course or user"}).status(401);
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
                handlers.postReturn(course, user, data.submissions[0]).then(insertedSubmission => {
                    console.log(`[OK] Add submission to db: course = ${course}, user = ${user}, exp = ${insertedSubmission.exp}`);
                }).catch((err) => {
                    console.log(`[FAIL] Add submission to db: course = ${course}, user = ${user}, Stepik response = ${buff}, error = ${err}`);
                });

                res.send(buff).status(rs.statusCode);
            } else {
                res.send({error: "Invalid backend response"}).status(401);
            }
        });
    });

    rq.write(body);
    rq.end();
});

router.get('/submissions/:id?', (req, res) => {
    if (req.headers.authorization == undefined || req.headers['content-type'] == undefined) {
        res.send({error: "Invalid headers"}).status(401);
        return;
    } 

    let options = {
        host: 'stepik.org',
        path: '/api/submissions' + (req.params.id ? '/' + req.params.id : '') + '?' + querystring.stringify(req.query),
        method: req.method,
        headers: {
            'Authorization': req.headers.authorization,
            'Content-Type': req.headers['content-type']
        }
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

                res.send(buff).status(rs.statusCode);
            } else {
                res.send({error: "Invalid backend response"}).status(401);
            }
        });
    });

    rq.end();
});

router.get('/rating', (req, res) => {
    let course = req.query.course;

    if (course == undefined || isNaN(course)) {
        res.send({error: "Invalid course id"}).status(401);
        return;
    } 

    let count = req.query.count ? req.query.count : 10;
    let delta = req.query.days ? req.query.days: undefined;

    handlers.getRating(course, count, delta).then(result => {
        res.send(result);
    }).catch((err) => {
        console.log(`[FAIL] Get rating from db: error = ${err}`);
        res.status(500).send({error: ""});
    });
});

module.exports = router;
