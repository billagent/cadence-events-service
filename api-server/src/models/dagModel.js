/**
 * Custom error classes for DAG operations
 */
class DAGValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DAGValidationError';
  }
}

class DAGNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DAGNotFoundError';
  }
}

module.exports = {
  DAGValidationError,
  DAGNotFoundError
};
