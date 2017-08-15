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
			return db.getTopForCourse(course, top, delta);
		} else {
			let rating = [];
			return new Promise((resolve, reject) => {
				db.getTopForCourse(course, top, delta)
				.then(result => {
					rating = result;

					let contains = false;
					for (record in rating) {
						if (record.user == user) {
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
					rating.push(res);
					resolve(rating);
				})
				.catch(err => reject(err));
			});
		}
	}
};
