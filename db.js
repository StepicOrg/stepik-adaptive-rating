const db = require('mysql-promise')();

const   DB_HOST = '',
        DB_USER = '',
        DB_PASS = '',
        DB_NAME = '';

db.configure({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME
});

const TABLE_SUBMISSIONS = '';

const Fields = {
    courseId: 'course_id',
    profileId: 'profile_id',
    cost: 'cost',
    submissionId: 'id',
    status: 'status',
    timestamp: 'update_at'
};

module.exports = {
    updateSubmissionStatus: function (submission) {
        return db.query(`UPDATE ${TABLE_SUBMISSIONS} SET ${Fields.status} = '${submission.status}' WHERE ${Fields.submissionId} = ${submission.id}`);
    },
    insertSubmission: function (submission) {
        return db.query(`INSERT INTO ${TABLE_SUBMISSIONS} VALUES (${submission.course_id}, ${submission.profile_id}, ${submission.cost}, ${submission.id}, '${submission.status}', NOW())`);
    },
    getNthSubmissionFromEnd: function (courseId, profileId, position) {
        return db.query(`SELECT * FROM ${TABLE_SUBMISSIONS} WHERE ${Fields.profileId} = ${profileId} AND ${Fields.courseId} = ${courseId} ORDER BY ${Fields.timestamp} DESC LIMIT ${position}, 1`);
    }
    getLastSubmission: function (courseId, profileId) {
        return this.getNthSubmissionFromEnd(courseId, profileId, 1);
    },
    calculateStreak: function (courseId, profileId) {
        return this.getLastSubmission(courseId, profileId).spread((submission) => {
            if (submission && submission[Fields.status] == 'correct') {
                return submission[Fields.cost] + 1;
            } else {
                return 1;
            }
        });
    }
};
