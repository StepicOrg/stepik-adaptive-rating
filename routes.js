const express = require('express'),
      router = express.Router(),
      https = require('https');

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


    let rq = https.request(options, (rs) => {
        console.log(`STATUS: ${rs.statusCode}`);
        console.log(`HEADERS: ${JSON.stringify(rs.headers)}`);

        var buff = '';
        rs.on('data', (chunk) => {buff += chunk});

        rs.on('end', () => {
          // console.log(buff);
            let data = JSON.parse(buff);

            console.log(data);

            res.send(buff).status(rs.statusCode);

        });
    });

    rq.write(body);
    rq.end();
});

module.exports = router;
