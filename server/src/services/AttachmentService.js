const AppError = require('../errors/AppError');

class AttachmentService {
  constructor({ taskRepository, attachmentRepository, fileStorage }) {
    this.taskRepository = taskRepository;
    this.attachmentRepository = attachmentRepository;
    this.fileStorage = fileStorage;
  }

  async add(taskId, file) {
    if (!file) throw new AppError('Выберите файл', 422, { file: 'Выберите файл' });

    const task = await this.taskRepository.findById(taskId);
    if (!task) throw new AppError(`Задача с id «${taskId}» не найдена`, 404);

    try {
      return await this.attachmentRepository.insert({
        taskId,
        originalName: file.originalname || 'file',
        storedName: file.filename,
        size: file.size,
        mimeType: file.mimetype || 'application/octet-stream',
      });
    } catch (error) {
      await this.fileStorage.remove(taskId, file.filename);
      if (error.code === '23503') {
        throw new AppError(`Задача с id «${taskId}» не найдена`, 404);
      }
      throw error;
    }
  }

  async remove(taskId, attachmentId) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) throw new AppError(`Задача с id «${taskId}» не найдена`, 404);

    const attachment = await this.attachmentRepository.findByTaskAndId(taskId, attachmentId);
    if (!attachment) throw new AppError('Вложение не найдено', 404);

    await this.attachmentRepository.delete(taskId, attachmentId);
    await this.fileStorage.remove(taskId, attachment.storedName);
  }

  async getForDownload(taskId, attachmentId) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) throw new AppError(`Задача с id «${taskId}» не найдена`, 404);

    const attachment = await this.attachmentRepository.findByTaskAndId(taskId, attachmentId);
    if (!attachment) throw new AppError('Вложение не найдено', 404);

    const filePath = this.fileStorage.resolve(taskId, attachment.storedName);
    if (!(await this.fileStorage.exists(filePath))) {
      throw new AppError('Файл не найден', 404);
    }
    return { attachment, filePath };
  }
}

module.exports = { AttachmentService };
