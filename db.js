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

module.exports = {
    insertSubmission: (submission) => {
        return db.query(`INSERT INTO ${TABLE_SUBMISSIONS} VALUES (${submission.course_id}, ${submission.profile_id}, ${submission.cost}, ${submission.id}, ${submission.status}, NOW())`)
    },
    getLastSubmission: (profileId) => {
        return db.query(`SELECT * FROM ${TABLE_SUBMISSIONS} WHERE profile_id = ${profileId} ORDER BY timestamp DESC LIMIT 1`);
    },
    calculateStreak: (profileId) => {
        return this.getLastSubmission(profileId).then((submission) => {
            if (submission && submission.status == 'correct') {
                return submission.cost + 1;
            } else {
                return 1;
            }
        });
    }
};
