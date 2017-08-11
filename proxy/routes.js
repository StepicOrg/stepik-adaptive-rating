const express = require('express'),
      router = express.Router(),
      https = require('https'),
      handlers = require('./handlers');

router.post('/submissions', (req, res) => {
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

    let course = req.body.course;
    let user = req.body.user;

    if (course == undefined || user == undefined || isNaN(course) || isNaN(user)) {
        res.send({error: "Invalid course or user"}).status(401);
        return;
    } 

    let rq = https.request(options, (rs) => {
        var buff = '';
        rs.on('data', (chunk) => {buff += chunk});

        rs.on('end', () => {
            let data = JSON.parse(buff);

            handlers.postReturn(course, user, data).then(insertedSubmission => {
                console.log(`[OK] Add submission to db: course = ${course}, user = ${user}, exp = ${insertedSubmission.exp}`);
            }).catch((err) => {
                console.log(`[FAIL] Add submission to db: course = ${course}, user = ${user}, Stepik response = ${buff}`);
            });

            res.send(buff).status(rs.statusCode);
        });
    });

    rq.write(body);
    rq.end();
});

router.get('/submissions/:id', (req, res) => {
    let options = {
        host: 'stepik.org',
        path: '/api/submissions',
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

            handlers.getReturn(data).then(_ => {
                console.log(`[OK] Update submission in db: id = ${data.id}, status = ${data.status}`);
            }).catch((err) => {
                console.log(`[FAIL] Update submission in db: Stepik response = ${buff}`);
            });

            res.send(buff).status(rs.statusCode);
        });
    });

    rq.end();

});

module.exports = router;
