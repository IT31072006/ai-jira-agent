function errorHandler(err, req, res, next) {
  console.error('[Error Handler]', err);

  const statusCode = err.statusCode || (err.status ? err.status : 500);
  const message = err.message || 'Lỗi máy chủ nội bộ. Vui lòng thử lại sau.';

  res.status(statusCode).json({
    error: err.name || 'Error',
    message,
  });
}

module.exports = errorHandler;
