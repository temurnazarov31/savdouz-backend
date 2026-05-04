const AppError = require('./appError');

const checkExists = (doc, name) => {
  if (!doc) {
    throw new AppError(`No ${name} found with that ID`, 404);
  }
};

module.exports = checkExists;
