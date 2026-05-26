const userService = require("../services/userService");
const adminMlService = require("../services/adminMlService");

async function listUsers(req, res) {
  const users = await userService.listUsers();
  res.json(users);
}

async function updateUser(req, res) {
  const user = await userService.updateUserAccess(req.params.userId, req.body);
  res.json(user);
}

async function getMlDashboard(req, res) {
  const dashboard = await adminMlService.getMlDashboard();
  res.json(dashboard);
}

async function uploadDataset(req, res) {
  const datasetVersion = await adminMlService.createDatasetVersionFromUpload(req.user.id, req.file);
  res.status(201).json(datasetVersion);
}

async function downloadDataset(req, res) {
  const datasetVersion = await adminMlService.getDatasetVersionForDownload(req.params.datasetVersionId);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  const encodedFileName = encodeURIComponent(datasetVersion.fileName);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${datasetVersion.fileName}"; filename*=UTF-8''${encodedFileName}`
  );
  res.send(datasetVersion.fileBuffer);
}

async function deleteDataset(req, res) {
  await adminMlService.deleteDatasetVersion(req.params.datasetVersionId);
  res.status(204).send();
}

async function startTrainingJob(req, res) {
  const trainingJob = await adminMlService.startTrainingJob(req.user.id, req.body.datasetVersionId);
  res.status(201).json(trainingJob);
}

async function applyTrainingJob(req, res) {
  const trainingJob = await adminMlService.applyTrainingJob(req.params.trainingJobId, req.user.id);
  res.json(trainingJob);
}

async function deleteTrainingJob(req, res) {
  await adminMlService.deleteTrainingJob(req.params.trainingJobId);
  res.status(204).send();
}

async function clearModelApplicationHistory(req, res) {
  await adminMlService.clearModelApplicationHistory();
  res.status(204).send();
}

module.exports = {
  applyTrainingJob,
  clearModelApplicationHistory,
  deleteDataset,
  deleteTrainingJob,
  downloadDataset,
  getMlDashboard,
  listUsers,
  startTrainingJob,
  uploadDataset,
  updateUser,
};
