const STATUS = {
  NEW: 'new',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
};

const STATUS_LABELS = {
  [STATUS.NEW]: 'Новая',
  [STATUS.IN_PROGRESS]: 'В процессе',
  [STATUS.DONE]: 'Выполнена',
};

const STATUS_LIST = Object.values(STATUS);

class Task {
  constructor({ id, title, description, status, dueDate, attachments = [], createdAt, updatedAt }) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.status = status;
    this.dueDate = dueDate;
    this.attachments = attachments;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  withAttachments(attachments) {
    return new Task({
      id: this.id,
      title: this.title,
      description: this.description,
      status: this.status,
      dueDate: this.dueDate,
      attachments,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    });
  }
}

module.exports = { Task, STATUS, STATUS_LABELS, STATUS_LIST };
