const { DAGValidationError, DAGNotFoundError } = require('../models/dagModel');

const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Handle custom errors
  if (err instanceof DAGValidationError) {
    return res.status(400).json({
      success: false,
      message: err.message,
      type: 'validation_error'
    });
  }

  if (err instanceof DAGNotFoundError) {
    return res.status(404).json({
      success: false,
      message: err.message,
      type: 'not_found_error'
    });
  }

  // Handle file system errors
  if (err.code === 'ENOENT') {
    return res.status(404).json({
      success: false,
      message: 'File not found',
      type: 'file_not_found'
    });
  }

  if (err.code === 'EACCES') {
    return res.status(403).json({
      success: false,
      message: 'Permission denied',
      type: 'permission_error'
    });
  }

  // Handle JSON parsing errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON format',
      type: 'json_parse_error'
    });
  }

  // Default error
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    type: 'internal_error'
  });
};

module.exports = errorHandler;
