const { STATUS, STATUS_LIST } = require('../models/Task');
const AppError = require('../errors/AppError');

class TaskService {
  constructor({ taskRepository, attachmentRepository, fileStorage }) {
    this.taskRepository = taskRepository;
    this.attachmentRepository = attachmentRepository;
    this.fileStorage = fileStorage;
  }

  async list(status) {
    const filter = status || null;
    if (filter && !STATUS_LIST.includes(filter)) {
      throw new AppError('Некорректный статус', 422, { status: 'Некорректный статус' });
    }
    const tasks = await this.taskRepository.findAll(filter);
    return this.#withAttachments(tasks);
  }

  async getById(id) {
    const task = await this.taskRepository.findById(id);
    if (!task) throw new AppError(`Задача с id «${id}» не найдена`, 404);
    const attachments = await this.attachmentRepository.findByTaskIds([task.id]);
    return task.withAttachments(attachments);
  }

  async create({ title, description, status, dueDate }) {
    const task = await this.taskRepository.insert({
      title: title.trim(),
      description: (description || '').trim(),
      status: status || STATUS.NEW,
      dueDate: dueDate || null,
    });
    return task.withAttachments([]);
  }

  async update(id, { title, description, status, dueDate }) {
    if (!STATUS_LIST.includes(status)) {
      throw new AppError('Некорректный статус', 422, { status: 'Некорректный статус' });
    }
    const task = await this.taskRepository.update(id, {
      title: title.trim(),
      description: (description || '').trim(),
      status,
      dueDate: dueDate || null,
    });
    if (!task) throw new AppError(`Задача с id «${id}» не найдена`, 404);
    const attachments = await this.attachmentRepository.findByTaskIds([task.id]);
    return task.withAttachments(attachments);
  }

  async delete(id) {
    const removed = await this.taskRepository.delete(id);
    if (!removed) throw new AppError(`Задача с id «${id}» не найдена`, 404);
    await this.fileStorage.removeTaskDir(id);
  }

  async #withAttachments(tasks) {
    if (tasks.length === 0) return tasks;
    const attachments = await this.attachmentRepository.findByTaskIds(tasks.map((task) => task.id));
    const grouped = new Map();
    for (const attachment of attachments) {
      const list = grouped.get(attachment.taskId) || [];
      list.push(attachment);
      grouped.set(attachment.taskId, list);
    }
    return tasks.map((task) => task.withAttachments(grouped.get(task.id) || []));
  }
}

module.exports = { TaskService };
