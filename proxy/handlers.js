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


function isFakeEmail(email) {
	return /adaptive_\d+_(android|ios)_[A-Za-z0-9]+@stepik\.org/.test(email)
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

// Get email by token and id
// Returns promise with emails
function resolveEmail(id, token) {
    return new Promise((resolve, reject) => {
        apiCall('/api/email-addresses?user=' + id, token).then(result => {
            let emails = []
            result["email-addresses"].forEach(a => {
                emails.push(a["email"]);
            });
            resolve(emails);
        })
        .catch(err => reject(err));
    });
}

//
function deanonymizeUserById(userId, token) {
    return new Promise((resolve, reject) => {
        resolveEmail(userId, token).then(emails => {
            if (emails.length == 0) {
                resolve({status: false, msg: 'has no emails'})
            } else {
                var hasRealEmail = false
                for (var i = 0; i < emails.length; i++) {
                    if (!isFakeEmail(emails[i])) {
                        hasRealEmail = true;

                        db.addNonFakeUser(userId)
                        .then(_ => resolve({status: true, msg: ''}))
                        .catch(err => reject(err));
                        break;
                    }
                }

                if (!hasRealEmail) {
                    resolve({status: false, msg: 'fake email'})
                }
            }
        }).catch(err => reject(err));
    });
}

module.exports = {
	putRating: function(course, rating, token) {
		return new Promise((resolve, reject) => {
			resolveToken(token)
			.then(userId => {
                deanonymizeUserById(userId, token)
                .then(r => {
                    if (r.status) {
                        console.log('[OK] User deanonymized, user id = ' + userId)
                    }
                })
                .catch(err => { console.log('[FAIL] Error while user deanonymization. ' + err) })

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
            .then(result => resolve({exp: result.exp, streak: 0}))
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
