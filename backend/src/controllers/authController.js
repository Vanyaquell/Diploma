const authService = require("../services/authService");

async function register(req, res) {
  const result = await authService.registerUser(req.body);
  res.status(201).json({
    user: result.user,
    accessToken: result.accessToken,
    tokenType: "Bearer",
  });
}

async function login(req, res) {
  const result = await authService.loginUser(req.body);
  res.json({
    user: result.user,
    accessToken: result.accessToken,
    tokenType: "Bearer",
  });
}

async function logout(req, res) {
  await authService.logoutUser(req.user.id);
  res.status(204).send();
}

module.exports = {
  register,
  login,
  logout,
};
