const db     = require('./db'),
      config = require('config');

const BOT_NUMBER = 50;
const MAX_EXP_DELTA = 20;

const ADD_ITERATIONS = 10;

module.exports = {
    BOTS_ADD_INTERVAL: 60 * 60,

    addBots: function () {
        try {
            let supportedCourses = config.get('supported_courses');

            var promises = [];

            for (var i = 0; i < supportedCourses.length; i++) {
                let cid = supportedCourses[i];

                for (var j = 0; j < ADD_ITERATIONS; j++) {
                    let profile = Math.floor(Math.random() * BOT_NUMBER);

                    promises.push(db.getUserExpAndRank(cid, profile).then(d => {
                        var exp = 0;
                        if (d) exp = d.exp;

                        let delta = Math.floor(Math.random() * MAX_EXP_DELTA);

                        return db.updateRating(cid, profile, exp + delta);
                    }));
                }
            }

            Promise.all(promises).then(_ => {
                console.log(`[OK] Bots successfully added`);
            }).catch(err => {
                console.log(`[FAIL] Bots add error = ${err}`);
            });
        } catch (err) {
            console.log(`[FATAL ERROR] Bots add error = ${err}`);
        }
    }
};
