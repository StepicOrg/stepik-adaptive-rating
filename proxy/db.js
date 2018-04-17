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
const users = config.get('table_users');

const getFirstArg = (r) => { return r[0]; }

module.exports = {
    addNonFakeUser: function (userId) {
        return db.query(`
                REPLACE INTO ${users.name} VALUES (?)
        `, [userId]);
    },

    updateRating: function (courseId, profileId, exp) {
        return db.query(`
                INSERT INTO ${submissions.name}
                (${submissions.fields.courseId}, ${submissions.fields.profileId}, ${submissions.fields.exp}, ${submissions.fields.timestamp})
                SELECT ?, ?, (
                    SELECT MAX(${submissions.fields.exp}) as ${submissions.fields.exp} FROM (
                        SELECT 0 as ${submissions.fields.exp}
                        UNION ALL
                        SELECT ? - IFNULL(SUM(${submissions.fields.exp}), 0) as ${submissions.fields.exp} FROM ${submissions.name} WHERE ${submissions.fields.courseId} = ? AND ${submissions.fields.profileId} = ?
                    ) a
                ), NOW()`, [courseId, profileId, exp, courseId, profileId]);
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
            WHERE ${submissions.fields.courseId} = ? ${delta}
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
            SELECT ${cache.fields.profileId}, ${cache.fields.exp}, ISNULL(${users.name}.${users.fields.id}) as is_not_fake
            FROM ${cache.name}
            LEFT JOIN ${users.name} ON ${cache.name}.${cache.fields.profileId} = ${users.name}.${users.fields.id}
            WHERE ${cache.fields.courseId} = ? AND ${cache.fields.delta} = ?
            ORDER BY ${cache.fields.exp} DESC, ${cache.fields.id} DESC
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
                    WHERE ${submissions.fields.courseId} = ? ${deltaSelect}
                    GROUP BY ${submissions.fields.profileId}
                    ORDER BY ${submissions.fields.exp} DESC`, [courseId, delta, courseId]);
            });
    },

    /**
     * @param courseId {number} - id of a course
     * @param profileId {number} - user id
     * @return Promise to object {exp, streak}
     */
    getUserExpAndStreak: function (courseId, profileId) {
        return db.query(`
            SELECT IFNULL(SUM(${submissions.fields.exp}), 0) as ${submissions.fields.exp} 
            FROM ${submissions.name} 
            WHERE ${submissions.fields.courseId} = ? AND ${submissions.fields.profileId} = ?
        `, [courseId, profileId]).then(getFirstArg).then(getFirstArg).then((r) => {
            let exp = r.exp;

            return db.query(`
                SELECT ${submissions.fields.exp}
                FROM ${submissions.name} 
                WHERE ${submissions.fields.courseId} = ? AND ${submissions.fields.profileId} = ?
                ORDER BY ${submissions.fields.timestamp} DESC
                LIMIT 1
            `, [courseId, profileId]).then(getFirstArg).then((r2) => {
                let streak = 0;
                if (r2.length === 1) {
                    streak = r2[0].exp;
                }
                return {'exp': exp, 'streak': streak};
            })
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
            SELECT ${cache.fields.id}, ${cache.fields.exp}
            FROM ${cache.name}
            WHERE ${cache.fields.courseId} = ? AND ${cache.fields.profileId} = ? AND ${cache.fields.delta} = ?
            `, [courseId, profileId, delta]).then(getFirstArg).spread((r) => {
                if (!r) return undefined;
                var exp = r.exp;
                let id = r.id;
                return db.query(`

                    SELECT SUM(rank) as rank FROM(
                        SELECT COUNT(*) as rank FROM ${cache.name} WHERE ${cache.fields.exp} > ? AND ${cache.fields.courseId} = ? AND ${cache.fields.delta} = ?
                        UNION ALL
                        SELECT COUNT(*) as rank FROM ${cache.name} WHERE ${cache.fields.exp} = ? AND ${cache.fields.courseId} = ? AND ${cache.fields.delta} = ? AND ${cache.fields.id} > ?
                    ) t`, [exp, courseId, delta, exp, courseId, delta, id]).then(getFirstArg).spread(rrr => {
                        rrr.exp = exp;
                        return rrr;
                    });
            });
    },

    countUsersInTop: function (courseId, delta) {
        delta = delta || 0;

        return db.query(`
            SELECT COUNT(*) AS count
            FROM ${cache.name}
            WHERE ${cache.fields.courseId} = ? AND ${cache.fields.delta} = ?`, [courseId, delta]).then(getFirstArg).then(getFirstArg);
    },
};
