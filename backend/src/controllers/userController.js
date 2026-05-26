const userService = require("../services/userService");

async function getMe(req, res) {
  const user = await userService.getCurrentUser(req.user.id);
  res.json(user);
}

async function updateMe(req, res) {
  const user = await userService.updateCurrentUserProfile(req.user.id, req.body);
  res.json(user);
}

async function updatePassword(req, res) {
  await userService.updateCurrentUserPassword(req.user.id, req.body);
  res.status(204).send();
}

module.exports = {
  getMe,
  updateMe,
  updatePassword,
};
