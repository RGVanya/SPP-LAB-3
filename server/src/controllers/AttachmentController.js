class AttachmentController {
  constructor(attachmentService) {
    this.attachmentService = attachmentService;
  }

  create = async (req, res) => {
    const attachment = await this.attachmentService.add(req.params.id, req.file);
    res.status(201)
      .location(`${req.baseUrl}/${req.params.id}/attachments/${attachment.id}/download`)
      .json({ attachment });
  };

  destroy = async (req, res) => {
    await this.attachmentService.remove(req.params.id, req.params.attachmentId);
    res.status(204).end();
  };

  download = async (req, res, next) => {
    const { attachment, filePath } = await this.attachmentService.getForDownload(
      req.params.id,
      req.params.attachmentId,
    );
    res.download(filePath, attachment.originalName, (error) => {
      if (error && !res.headersSent) next(error);
    });
  };
}

module.exports = { AttachmentController };
