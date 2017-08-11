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
            VALUES (${submission.course_id}, ${submission.profile_id}, ${submission.exp}, ${submission.id}, '${submission.status}', NOW())`);
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


    getTopForCourse: function (courseId, count) {
        return db.query(`
            SELECT ${submissions.fields.profileId}, sum(${submissions.fields.exp}) as ${submissions.fields.exp}
            FROM ${submissions.name}
            WHERE ${submissions.fields.status} = 'correct' AND ${submissions.fields.courseId} = ${courseId}
            GROUP BY ${submissions.fields.profileId}
            ORDER BY ${submissions.fields.exp} DESC
            LIMIT ${count}`);
    },

    saveTopToCache: function (courseId, top) {
        return db.query(`DELETE FROM ${cache.name} WHERE ${cache.fields.courseId} = ${courseId}`)
            .then(() => {
                return Promise.all(top.map((item) => {
                    return db.query(`INSERT INTO ${cache.name} VALUES (null, ${courseId}, ${item.profileId}, ${item.exp})`)
                }));
            });
    },

    getTopForCourseFromCache: function (courseId, count) {
        return db.query(`
            SELECT ${cache.fields.profileId}, ${cache.fields.exp}
            FROM ${cache.name}
            WHERE ${cache.fields.courseId} = ${courseId}
            ORDER BY ${cache.fields.exp}`);
    }
};
