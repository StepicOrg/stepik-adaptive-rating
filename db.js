const
    db      = require('mysql-promise')(),
    config  = require('config');

db.configure(config.get('db'));

const submissions = config.get('table_submissions');
const cache = config.get('table_cache');

module.exports = {
    updateSubmissionStatus: function (submission) {
        return db.query(`
            UPDATE ${submissions.name}
            SET ${submissions.fields.status} = '${submission.status}'
            WHERE ${submissions.fields.submissionId} = ${submission.id}`);
    },
    insertSubmission: function (submission) {
        return db.query(`
            INSERT INTO ${submissions.name}
            VALUES (${submission.course}, ${submission.user}, ${submission.exp}, ${submission.id}, '${submission.status}', NOW())`);
    },
    getNthSubmissionFromEnd: function (courseId, profileId, position, status) {
        if (status) status = `AND ${submissions.fields.status} == '${status}'`
        return db.query(`
            SELECT * FROM ${submissions.name}
            WHERE ${submissions.fields.profileId} = ${profileId} AND ${submissions.fields.courseId} = ${courseId} ${status}
            ORDER BY ${submissions.fields.timestamp} DESC
            LIMIT ${position}, 1`);
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
        if (delta) delta = `AND ${submissions.fields.timestamp} >= (SELECT DATETIME('now', '-${delta} day'))`

        return db.query(`
            SELECT ${submissions.fields.profileId}, sum(${submissions.fields.exp}) as ${submissions.fields.exp}, ${submissions.fields.timestamp}
            FROM ${submissions.name}
            WHERE ${submissions.fields.status} = 'correct' AND ${submissions.fields.courseId} = ${courseId} ${delta}
            GROUP BY ${submissions.fields.profileId}
            ORDER BY ${submissions.fields.exp} DESC
            LIMIT ${count}`);
    },


    /**
    * @param courseId {number} - id of a course
    * @param top {[{profile_id, exp, submissions.fields.timestamp }]} - array of top users
    * @param {boolean} [saveTimestamp] - if true not erases submissions.fields.timestamp field
    */
    saveTopToCache: function (courseId, top, saveTimestamp) {
        return db.query(`DELETE FROM ${cache.name} WHERE ${cache.fields.courseId} = ${courseId} AND ${cache.fields.timestamp} ${saveTimestamp ? '!=' : '='} 0`)
            .then(() => {
                return Promise.all(top.map((item) => {
                    return db.query(`INSERT INTO ${cache.name} VALUES (null, ${courseId}, ${item.profileId}, ${item.exp}, ${saveTimestamp ? item[submissions.fields.timestamp] : 0})`)
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
        delta = `AND ${cache.fields.timestamp}` + (delta ? `>= (SELECT DATETIME('now', '-${delta} day'))` : `= 0`);

        return db.query(`
            SELECT ${cache.fields.profileId}, ${cache.fields.exp}
            FROM ${cache.name}
            WHERE ${cache.fields.courseId} = ${courseId} ${delta}
            ORDER BY ${cache.fields.exp}`);
    }
};
