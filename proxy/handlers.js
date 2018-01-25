const
      db = require('./db'),
      handlers = require('./handlers'),
      https = require('https');

// Make api request
// Returns promise with response
function apiCall(endpoint, bearer) {
    return new Promise((resolve, reject) => {
        let headers = {'Authorization': 'Bearer ' + bearer};
        let options = {host: 'stepik.org', path: endpoint, method: 'GET', headers: headers};

        let req = https.request(options, res => {
            res.setEncoding('utf-8');

            let responseString = '';

            res.on('data', data => {
                responseString += data;
            });

            res.on('end', () => {
                resolve(JSON.parse(responseString));
            });
        });

        req.end();
    });
}

// Get id by token
// Returns promise with id
function resolveToken(token) {
    return new Promise((resolve, reject) => {
        apiCall('/api/stepics/1', token).then(result => {
            if (result["users"][0]["is_guest"] != undefined && !result["users"][0]["is_guest"]) {
                resolve(result["users"][0]["id"]);
            } else {
                reject();
            }
        });
    });
}

module.exports = {
	putRating: function(course, rating, token) {
		return new Promise((resolve, reject) => {
			resolveToken(token)
			.then(userId => {
				return db.updateRating(course, userId, rating);
			})
			.then(_ => resolve())
			.catch(err => reject(err));
		});
	},
    restoreRating: function(course, token) {
        return new Promise((resolve, reject) => {
            resolveToken(token)
            .then(userId => {
                return db.getUserExpAndStreak(course, userId);
            })
            .then(result => resolve({exp: result.exp, streak: result.streak}))
            .catch(err => reject(err));
        });
    },
	getRating: function(course, top, delta, user) {
		let ratingCnt = 0;
		if (!user) {
			return new Promise((resolve, reject) => {
				db.countUsersInTop(course, delta).then(r => {
					ratingCnt = r.count;
					return db.getTopForCourseFromCache(course, 0, top, delta);
				})
				.then(result => {
					result.forEach((e, i, a) => { e.rank = i + 1; });
					resolve({count: ratingCnt, users: result});
				}).catch(err => reject(err));
			});
		} else {
			let rating = [];
			let offset = -1;
			return new Promise((resolve, reject) => {
				db.countUsersInTop(course, delta).then(r => {
					ratingCnt = r.count;
					return db.getTopForCourseFromCache(course, 0, top, delta);
				})
				.then(result => {
					result.forEach((e, i, a) => { e.rank = i + 1; });

					rating = result;

					let contains = rating.some(item => { return item.user == user; });

					if (contains) {
						resolve({count: ratingCnt, users: rating});
						return;
					} else {
						return db.getUserExpAndRank(course, user, delta);
					}
				})
				.then(res => {
					if (res != undefined && res.rank != undefined && res.exp != undefined) {
						offset = res.rank == top + 1 ? res.rank - 1 : res.rank - 2;
						let count = res.rank == top + 1 ? 2 : 3;
						return db.getTopForCourseFromCache(course, offset + 1, count, delta);
					} else {
						resolve({count: ratingCnt, users: rating});
						return;
					}
				})
				.then(res => {
					if (res != undefined) {
						res.forEach((e, i, a) => { e.rank = offset + i + 1; });
						rating = rating.concat(res);
					}
					resolve({count: ratingCnt, users: rating});
				})
				.catch(err => reject(err));
			});
		}
	}
};
