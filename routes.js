const express = require('express'),
      router = express.Router(),
      request = require('request');

router.post('/submissions', (req, res) => {
    let options = {
        uri: 'https://stepik.org/api/submissions',
        method: req.method,
        headers: req.headers,
        body: JSON.stringify(req.body),
        rejectUnauthorized: false
    }

    request(options, (error, response, body) => {
        res.send(body).status(response.statusCode);
    });
});

module.exports = router;