class TaskController {
  constructor(taskService) {
    this.taskService = taskService;
  }

  list = async (req, res) => {
    const tasks = await this.taskService.list(req.query.status);
    res.json({ tasks });
  };

  show = async (req, res) => {
    const task = await this.taskService.getById(req.params.id);
    res.json({ task });
  };

  create = async (req, res) => {
    const task = await this.taskService.create(req.body);
    res.status(201).location(`${req.baseUrl}/${task.id}`).json({ task });
  };

  update = async (req, res) => {
    const task = await this.taskService.update(req.params.id, req.body);
    res.json({ task });
  };

  destroy = async (req, res) => {
    await this.taskService.delete(req.params.id);
    res.status(204).end();
  };
}

module.exports = { TaskController };
