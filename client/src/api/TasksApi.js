export class TasksApi {
  constructor(http) {
    this.http = http;
  }

  list(status) {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.#request(`/tasks${query}`);
  }

  get(id) {
    return this.#request(`/tasks/${encodeURIComponent(id)}`);
  }

  create(task) {
    return this.#request('/tasks', { method: 'POST', body: task });
  }

  update(id, task) {
    return this.#request(`/tasks/${encodeURIComponent(id)}`, { method: 'PUT', body: task });
  }

  remove(id) {
    return this.#request(`/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  upload(id, file) {
    const formData = new FormData();
    if (file) formData.append('file', file);
    return this.#request(`/tasks/${encodeURIComponent(id)}/attachments`, {
      method: 'POST',
      formData,
    });
  }

  removeAttachment(taskId, attachmentId) {
    return this.#request(
      `/tasks/${encodeURIComponent(taskId)}/attachments/${encodeURIComponent(attachmentId)}`,
      { method: 'DELETE' },
    );
  }

  // Скачиваем через fetch, а не ссылкой: файлу тоже нужен заголовок Authorization.
  async download(taskId, attachmentId, fileName) {
    const response = await this.#request(
      `/tasks/${encodeURIComponent(taskId)}/attachments/${encodeURIComponent(attachmentId)}/download`,
      { raw: true },
    );
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  #request(path, options) {
    return this.http.request(path, options);
  }
}
