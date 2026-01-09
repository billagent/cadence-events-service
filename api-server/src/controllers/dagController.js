const express = require('express');
const dagService = require('../services/dagService');
const { validateDAGRequest, validateUUID } = require('../middleware/validation');

const router = express.Router();

/**
 * POST /api/cadence-event
 * Create a new DAG file
 */
router.post('/', validateDAGRequest, async (req, res, next) => {
  try {
    const dagData = req.body;
    const result = await dagService.createDAG(dagData);
    
    res.status(201).json({
      success: true,
      message: 'DAG created successfully',
      data: {
        contract_uuid: result.contract_uuid,
        file_path: result.file_path,
        dag_name: result.dag_name
      }
    });
  } catch (error) {
    console.error('Error creating DAG:', error);
    next(error);
  }
});

/**
 * GET /api/cadence-event/:uuid/:requestType
 * Fetch an existing DAG file
 */
router.get('/:uuid/:requestType', validateUUID, async (req, res, next) => {
  try {
    const { uuid, requestType } = req.params;
    // Convert URL parameter from kebab-case to snake_case
    const normalizedRequestType = requestType.replace(/-/g, '_');
    const dagData = await dagService.getDAG(uuid, normalizedRequestType);
    
    res.json({
      success: true,
      data: dagData
    });
  } catch (error) {
    console.error('Error getting DAG:', error);
    next(error);
  }
});

/**
 * PUT /api/cadence-event/:uuid/:requestType
 * Update an existing DAG file
 */
router.put('/:uuid/:requestType', validateUUID, validateDAGRequest, async (req, res, next) => {
  try {
    const { uuid, requestType } = req.params;
    const dagData = req.body;
    
    // Convert URL parameter from kebab-case to snake_case
    const normalizedRequestType = requestType.replace(/-/g, '_');
    
    // Ensure request type matches URL parameter
    if (dagData.request_type !== normalizedRequestType) {
      return res.status(400).json({
        success: false,
        message: 'Request type in body must match URL parameter'
      });
    }
    
    const result = await dagService.updateDAG(uuid, dagData);
    
    res.json({
      success: true,
      message: 'DAG updated successfully',
      data: {
        contract_uuid: result.contract_uuid,
        file_path: result.file_path,
        dag_name: result.dag_name
      }
    });
  } catch (error) {
    console.error('Error updating DAG:', error);
    next(error);
  }
});

/**
 * DELETE /api/cadence-event/:uuid/:requestType
 * Delete a DAG file
 */
router.delete('/:uuid/:requestType', validateUUID, async (req, res, next) => {
  try {
    const { uuid, requestType } = req.params;
    // Convert URL parameter from kebab-case to snake_case
    const normalizedRequestType = requestType.replace(/-/g, '_');
    await dagService.deleteDAG(uuid, normalizedRequestType);
    
    res.json({
      success: true,
      message: 'DAG deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting DAG:', error);
    next(error);
  }
});

module.exports = router;
