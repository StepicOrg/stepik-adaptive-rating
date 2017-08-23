const PORT = 9000;

const express = require('express');
const app = express(),
      server = require('http').createServer(app),
      bodyParser = require('body-parser'),
      db = require('./db'),
      config = require('config'),
      bots = require('./bots');

app.use(bodyParser.json());
app.use('/', require('./routes'));

let rebuildCaches = () => {
    try {
        let supportedDays = config.get('supported_days');
        let supportedCourses = config.get('supported_courses');
        for (var i = 0; i < supportedCourses.length; i++) {
            let cid = supportedCourses[i];
            for (var j = 0; j < supportedDays.length; j++) {
                let days = supportedDays[j];
                db.buildRatingTable(cid, days)
                .then(_ => console.log(`[OK] Cache builded for course = ${cid}, days = ${days}`))
                .catch(err => console.log(`[FAIL] Build cache failed for course = ${cid}, days = ${days}, error = ${err}`));
            }
        }
    } catch (err) {
        console.log(`[FATAL ERROR] Build cache failed error = ${err}`)
    }
};

setInterval(() => rebuildCaches(), 1 * 60 * 1000);

setInterval(bots.addBots, bots.BOTS_ADD_INTERVAL * 1000);

server.listen(PORT, () => {
    console.log(`Server started on port ${PORT}...`);
    bots.addBots();
    rebuildCaches();
});
