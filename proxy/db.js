const
    db      = require('mysql-promise')(),
    config  = require('config'),
    SqlString = require('sqlstring');

db.configure({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
});

const submissions = config.get('table_submissions');
const cache = config.get('table_cache');

const getFirstArg = (r) => { return r[0]; }

module.exports = {
    updateSubmissionStatus: function (submission) {
        return db.query(`
            UPDATE ${submissions.name}
            SET ${submissions.fields.status} = ?
            WHERE ${submissions.fields.submissionId} = ?`, [submission.status, submission.id]);
    },
    insertSubmission: function (submission) {
        return db.query(`
            INSERT INTO ${submissions.name}
            VALUES (?, ?, ?, ?, ?, NOW())`, [submission.course, submission.user, submission.exp, submission.id, submission.status]);
    },
    getNthSubmissionFromEnd: function (courseId, profileId, position, status) {
        status = status ? `AND ${submissions.fields.status} = ${SqlString.escape(status)}` : `AND (${submissions.fields.status} = 'correct' OR ${submissions.fields.status} = 'wrong')`;
        return db.query(`
            SELECT * FROM ${submissions.name}
            WHERE ${submissions.fields.profileId} = ? AND ${submissions.fields.courseId} = ? ${status}
            ORDER BY ${submissions.fields.submissionId} DESC
            LIMIT ?, 1`, [profileId, courseId, position]).then(getFirstArg);
    },
    getLastSubmission: function (courseId, profileId) {
        return this.getNthSubmissionFromEnd(courseId, profileId, 1);
    },
    getLastCorrectSubmission: function (courseId, profileId) {
        return this.getNthSubmissionFromEnd(courseId, profileId, 1, 'correct');
    },
    calculateStreak: function (courseId, profileId) {
        return this.getLastSubmission(courseId, profileId).spread((submission) => {
            if (submission && submission[submissions.fields.status] == 'correct') {
                return submission[submissions.fields.exp] + 1;
            } else {
                return 1;
            }
        });
    },


    /**
    * @param courseId {number} - id of a course
    * @param count {number} - max number of users you want to get
    * @param {number} [delta] - if set period in days for which you want get top
    * @return - array of top users like [{profile_id, exp, submissions.fields.timestamp }]
    */
    getTopForCourse: function (courseId, count, delta) {
        delta = delta ? `AND ${submissions.fields.timestamp} >= DATE_SUB (CURDATE(), INTERVAL ${SqlString.escape(delta)} DAY)` : '';

        return db.query(`
            SELECT ${submissions.fields.profileId}, sum(${submissions.fields.exp}) as ${submissions.fields.exp}
            FROM ${submissions.name}
            WHERE ${submissions.fields.status} = 'correct' AND ${submissions.fields.courseId} = ? ${delta}
            GROUP BY ${submissions.fields.profileId}
            ORDER BY ${submissions.fields.exp} DESC
            LIMIT ${count}`, [courseId]).then(getFirstArg);
    },


    /**
    * @param courseId {number} - id of a course
    * @param top {[{profile_id, exp, submissions.fields.timestamp }]} - array of top users
    * @param {boolean} [saveTimestamp] - if true not erases submissions.fields.timestamp field
    */
    saveTopToCache: function (courseId, top, saveTimestamp) {
        return db.query(`
            DELETE FROM ${cache.name}
            WHERE ${cache.fields.courseId} = ? AND ${cache.fields.timestamp} ${saveTimestamp ? '!=' : '='} 0`,
            [courseId])
            .then(() => {
                return Promise.all(top.map((item) => {
                    return db.query(`INSERT INTO ${cache.name} VALUES (null, ?, ?, ?, ?)`,
                     [courseId, item[submissions.fields.profileId], item[submissions.fields.exp], (saveTimestamp ? item[submissions.fields.timestamp] : 0)])
                }));
            });
    },

    /**
    * @param courseId {number} - id of a course
    * @param count {number} - max number of users you want to get
    * @param {number} [delta] - if set period in days for which you want get top
    * @return - array of top users like [{profile_id, exp, submissions.fields.timestamp }]
    */
    getTopForCourseFromCache: function (courseId, count, delta) {
        delta = `AND ${cache.fields.timestamp} ` + (delta ? `>= DATE_SUB (CURDATE(), INTERVAL ${SqlString.escape(delta)} DAY)` : `= 0`);

        return db.query(`
            SELECT ${cache.fields.profileId}, ${cache.fields.exp}
            FROM ${cache.name}
            WHERE ${cache.fields.courseId} = ? ${delta}
            ORDER BY ${cache.fields.exp}`, [courseId]).then(getFirstArg);
    }
};
