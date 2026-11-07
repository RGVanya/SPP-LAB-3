export class ApiError extends Error {
  constructor(message, status, fields = {}, { type, requestId, retryAfter, attemptsLeft } = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
    this.type = type;
    this.requestId = requestId;
    this.retryAfter = retryAfter;
    this.attemptsLeft = attemptsLeft;
  }

  // Разбор application/problem+json (RFC 9457).
  static async fromResponse(response) {
    const data = await response.json().catch(() => ({}));
    const retryHeader = Number(response.headers.get('Retry-After'));
    return new ApiError(
      data.detail || 'Не удалось выполнить запрос',
      response.status,
      data.fields || {},
      {
        type: data.type,
        requestId: data.requestId || response.headers.get('X-Request-Id') || undefined,
        retryAfter: data.retryAfter ?? (retryHeader || undefined),
        attemptsLeft: data.attemptsLeft,
      },
    );
  }
}
