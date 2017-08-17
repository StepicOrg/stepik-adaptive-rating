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
    Errors: {
        AlreadyMigrateError: 'User has already migrated'
    },

    updateSubmissionStatus: function (submission) {
        return db.query(`
            UPDATE ${submissions.name}
            SET ${submissions.fields.status} = ?
            WHERE ${submissions.fields.submissionId} = ?`, [submission.status, submission.id]);
    },
    insertSubmission: function (submission, forceId, timestamp) {

        forceId = forceId ? `(SELECT MIN(${submissions.fields.submissionId} - 1) AS ${submissions.fields.submissionId} FROM ${submissions.name})` : SqlString.escape(submission.id);
        timestamp = timestamp ? SqlString.format('FROM_UNIXTIME(?)', [timestamp]) : 'NOW()';

        return db.query(`
            INSERT INTO ${submissions.name}
            (${submissions.fields.courseId}, ${submissions.fields.profileId}, ${submissions.fields.exp}, ${submissions.fields.submissionId}, ${submissions.fields.status}, ${submissions.fields.timestamp})
            SELECT ?, ?, ?, ${forceId}, ?, ${timestamp}`, [submission.course, submission.user, submission.exp, submission.status]);
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
        return this.getNthSubmissionFromEnd(courseId, profileId, 0);
    },
    getLastCorrectSubmission: function (courseId, profileId) {
        return this.getNthSubmissionFromEnd(courseId, profileId, 0, 'correct');
    },
    calculateStreak: function (courseId, profileId, isStreakRestored) {
        return (isStreakRestored ? this.getLastCorrectSubmission(courseId, profileId) : this.getLastSubmission(courseId, profileId)).spread((submission) => {
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
        delta = delta ? `AND ${submissions.fields.timestamp} >= DATE_SUB (NOW(), INTERVAL ${SqlString.escape(delta)} DAY)` : '';

        return db.query(`
            SELECT ${submissions.fields.profileId}, sum(${submissions.fields.exp}) as ${submissions.fields.exp}
            FROM ${submissions.name}
            WHERE ${submissions.fields.status} = 'correct' AND ${submissions.fields.courseId} = ? ${delta}
            GROUP BY ${submissions.fields.profileId}
            ORDER BY ${submissions.fields.exp} DESC
            LIMIT ?`, [courseId, count]).then(getFirstArg);
    },

    /**
    * @param courseId {number} - id of a course
    * @param start {number} - starting users rank, if 0 you get top users
    * @param count {number} - max number of users you want to get
    * @param {number} [delta] - if set period in days for which you want get top
    * @return - array of top users like [{profile_id, exp, submissions.fields.timestamp }]
    */
    getTopForCourseFromCache: function (courseId, start, count, delta) {
        delta = delta || 0;

        return db.query(`
            SELECT ${cache.fields.profileId}, ${cache.fields.exp}
            FROM ${cache.name}
            WHERE ${cache.fields.courseId} = ? AND ${cache.fields.delta} = ?
            ORDER BY ${cache.fields.exp} DESC
            LIMIT ?, ?`, [courseId, delta, start, count]).then(getFirstArg);
    },


    /**
    * Builds rating table for given course in given period of time in days. WARNING: maybe very slow (60+ seconds on 40k items).
    * @param courseId {number} - id of a course
    * @param {number} [delta] - if set period in days for which you want get top
    */
    buildRatingTable: function (courseId, delta) {
        delta = delta || 0;

        return db.query(`
            DELETE FROM ${cache.name}
            WHERE ${cache.fields.courseId} = ? AND ${cache.fields.delta} = ?`, [courseId, delta]).then(_ => {

                deltaSelect = delta != 0 ? `AND ${submissions.fields.timestamp} >= DATE_SUB (NOW(), INTERVAL ${SqlString.escape(delta)} DAY)` : '';

                return db.query(`
                    INSERT INTO ${cache.name} (${cache.fields.id}, ${cache.fields.courseId}, ${submissions.fields.profileId}, ${submissions.fields.exp}, ${cache.fields.delta})
                    SELECT null, ?, ${submissions.fields.profileId}, sum(${submissions.fields.exp}) as ${submissions.fields.exp}, ?
                    FROM ${submissions.name}
                    WHERE ${submissions.fields.status} = 'correct' AND ${submissions.fields.courseId} = ? ${deltaSelect}
                    GROUP BY ${submissions.fields.profileId}
                    ORDER BY ${submissions.fields.exp} DESC`, [courseId, delta, courseId]);
            });
    },

    /**
    * @param courseId {number} - id of a course
    * @param profileId {number} - user id
    * @param {number} [delta] - if set period in days for which you want get top
    *
    * @return Promise to object {exp, rank} where exp - user's exp and rank is his position in top
    */
    getUserExpAndRank: function (courseId, profileId, delta) {
        delta = delta || 0;

        return db.query(`
            SELECT ${cache.fields.exp}, FIND_IN_SET(${cache.fields.exp}, (
                SELECT GROUP_CONCAT (${cache.fields.exp} ORDER BY ${cache.fields.exp} DESC) FROM ${cache.name}
                WHERE ${cache.fields.courseId} = ? AND ${cache.fields.delta} = ?
            )) AS rank
            FROM ${cache.name}
            WHERE ${cache.fields.courseId} = ? AND ${cache.fields.profileId} = ? AND ${cache.fields.delta} = ?`, [courseId, delta, courseId, profileId, delta]).then(getFirstArg).then(getFirstArg);
    },

    migrate: function (courseId, profileId, exp, streak) {
        return db.query(`
            SELECT ${submissions.fields.profileId}
            FROM ${submissions.name}
            WHERE ${submissions.fields.courseId} = ? AND ${submissions.fields.profileId} = ?`, [courseId, profileId]).then(getFirstArg)

            .then(r => {
                if (r.length === 0) {
                    return this.insertSubmission({course: courseId, user: profileId, exp: streak, id: -1, status: 'correct'}, true, 0).then(_ => {
                        return this.insertSubmission({course: courseId, user: profileId, exp: exp - streak, id: -1, status: 'correct'}, true, 0);
                    });
                } else {
                    return this.Errors.AlreadyMigrateError;
                }
            })
    }
};
