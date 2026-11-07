const { requestContext } = require('./AuthController');

class AdminController {
  constructor({ userService, sessionService }) {
    this.userService = userService;
    this.sessionService = sessionService;
  }

  listUsers = async (req, res) => {
    const users = await this.userService.list();
    res.json({ users });
  };

  changeRole = async (req, res) => {
    const user = await this.userService.changeRole(
      req.user,
      req.params.userId,
      req.body.role,
      requestContext(req),
    );
    res.json({ user });
  };

  listSessions = async (req, res) => {
    const sessions = await this.sessionService.listAll();
    res.json({ sessions });
  };

  revokeSession = async (req, res) => {
    await this.sessionService.revokeAny(req.user, req.params.sessionId, requestContext(req));
    res.status(204).end();
  };
}

module.exports = { AdminController };
