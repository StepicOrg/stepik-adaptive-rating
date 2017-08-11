const 
      db = require('./db'),
      handlers = require('./handlers');

module.exports = {
	postReturn: function(course, user, submission) {
		return new Promise((resolve, reject) => {
			submission.course = course;
			submission.user = user;

			db.calculateStreak(course, user)
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
	}
};
