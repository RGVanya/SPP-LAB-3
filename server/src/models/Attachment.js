class Attachment {
  constructor({ id, taskId, originalName, storedName, size, mimeType, uploadedAt }) {
    this.id = id;
    this.taskId = taskId;
    this.originalName = originalName;
    this.storedName = storedName;
    this.size = Number(size);
    this.mimeType = mimeType;
    this.uploadedAt = uploadedAt;
  }

  // Имя файла на диске клиенту не отдаём: скачивание идёт через отдельный маршрут.
  toJSON() {
    return {
      id: this.id,
      originalName: this.originalName,
      size: this.size,
      mimeType: this.mimeType,
      uploadedAt: this.uploadedAt,
    };
  }
}

module.exports = { Attachment };
