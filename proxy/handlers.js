const 
      db = require('./db'),
      handlers = require('./handlers');

module.exports = {
	postReturn: function(course, user, submission, isStreakRestored) {
		return new Promise((resolve, reject) => {
			submission.course = course;
			submission.user = user;

			db.calculateStreak(course, user, isStreakRestored)
			.then((streak) => {
				submission.exp = streak;

				return db.insertSubmission(submission);
			})
			.then(_ => resolve(submission))
			.catch((error) => reject(error));
		});
	},
	getReturn: function(submission) {
		return db.updateSubmissionStatus(submission);
	},
	getRating: function(course, top, delta, user) {
		if (!user) {
			return new Promise((resolve, reject) => {
				db.getTopForCourseFromCache(course, 0, top, delta).then(result => {
					result.forEach((e, i, a) => { e.rank = i + 1; });
					resolve(result);
				}).catch(err => reject(err));
			});
		} else {
			let rating = [];
			return new Promise((resolve, reject) => {
				db.getTopForCourseFromCache(course, 0, top, delta)
				.then(result => {
					result.forEach((e, i, a) => { e.rank = i + 1; });

					rating = result;

					let contains = false;
					for (var i = 0; i < rating.length; i++) {
						if (rating[i].user == user) {
							contains = true;
							break;
						}
					}

					if (contains) {
						resolve(rating);
						return;
					} else {
						return db.getUserExpAndRank(course, user, delta);
					}
				})
				.then(res => {
					if (res != undefined && res.rank != undefined && res.exp != undefined) {
						return db.getTopForCourseFromCache(course, res.rank - (res.rank > top), 2 + (res.rank > top), delta);
					} else {
						resolve(rating);
						return;
					}
				})
				.then(res => {
					if (res != undefined) {
						res.forEach((e, i, a) => { e.rank = i + 1; });
						rating.concat(res);
					}
					resolve(rating);
				})
				.catch(err => reject(err));
			});
		}
	}
};
