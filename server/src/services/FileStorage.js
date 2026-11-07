const fs = require('fs');
const path = require('path');

class FileStorage {
  constructor(uploadsDir) {
    this.uploadsDir = uploadsDir;
    fs.mkdirSync(this.uploadsDir, { recursive: true });
  }

  resolve(taskId, storedName) {
    const root = path.resolve(this.uploadsDir, taskId);
    const filePath = path.resolve(root, storedName);
    if (!filePath.startsWith(`${root}${path.sep}`)) {
      throw new Error('Некорректный путь к файлу');
    }
    return filePath;
  }

  async exists(filePath) {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async remove(taskId, storedName) {
    await fs.promises.rm(this.resolve(taskId, storedName), { force: true });
  }

  async removeTaskDir(taskId) {
    const root = path.resolve(this.uploadsDir);
    const dir = path.resolve(root, taskId);
    if (dir !== root && !dir.startsWith(`${root}${path.sep}`)) return;
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
}

module.exports = { FileStorage };
