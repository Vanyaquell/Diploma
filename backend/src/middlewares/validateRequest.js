const HttpError = require("../utils/httpError");

function validateRequest(schema, source = "body") {
  return function validate(req, res, next) {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return next(
        new HttpError(400, firstIssue?.message || "Validation failed.", {
          issues: result.error.issues,
        })
      );
    }

    req[source] = result.data;
    next();
  };
}

module.exports = validateRequest;
