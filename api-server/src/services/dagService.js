const fs = require('fs').promises;
const path = require('path');
const yamlGenerator = require('../utils/yamlGenerator');
const fileManager = require('../utils/fileManager');
const { DAGValidationError, DAGNotFoundError } = require('../models/dagModel');

const DAG_DIR = process.env.DAG_DIR || '/home/dagu/dags';

class DAGService {
  /**
   * Create a new DAG file
   */
  async createDAG(dagData) {
    try {
      // Validate required fields
      this.validateDAGData(dagData);
      
      // Generate DAG name using acronyms to fit 40 char limit
      const requestTypeAcronym = this.getRequestTypeAcronym(dagData.request_type);
      const dagName = `${dagData.contract_uuid}-${requestTypeAcronym}`;
      const fileName = `${dagName}.yaml`;
      const filePath = path.join(DAG_DIR, fileName);
      
      // Check if file already exists
      const exists = await fileManager.fileExists(filePath);
      if (exists) {
        throw new DAGValidationError(`DAG with name ${dagName} already exists`);
      }
      
      // Generate YAML content with the DAG name
      const yamlContent = yamlGenerator.generateDAGYAML(dagData, dagName);
      
      // Write file
      await fileManager.writeFile(filePath, yamlContent);
      
      return {
        contract_uuid: dagData.contract_uuid,
        file_path: filePath,
        dag_name: dagName
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get an existing DAG file
   */
  async getDAG(contractUuid, requestType) {
    try {
      const requestTypeAcronym = this.getRequestTypeAcronym(requestType);
      const dagName = `${contractUuid}-${requestTypeAcronym}`;
      const fileName = `${dagName}.yaml`;
      const filePath = path.join(DAG_DIR, fileName);
      
      const exists = await fileManager.fileExists(filePath);
      if (!exists) {
        throw new DAGNotFoundError(`DAG with name ${dagName} not found`);
      }
      
      const yamlContent = await fileManager.readFile(filePath);
      const dagData = yamlGenerator.parseDAGYAML(yamlContent);
      
      return {
        contract_uuid: contractUuid,
        dag_name: dagName,
        yaml_content: yamlContent,
        parsed_data: dagData
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update an existing DAG file
   */
  async updateDAG(contractUuid, dagData) {
    try {
      // Validate required fields
      this.validateDAGData(dagData);
      
      // Ensure contract_uuid matches the URL parameter
      if (dagData.contract_uuid !== contractUuid) {
        throw new DAGValidationError('Contract UUID in request body must match URL parameter');
      }
      
      // Generate DAG name using acronyms to fit 40 char limit
      const requestTypeAcronym = this.getRequestTypeAcronym(dagData.request_type);
      const dagName = `${contractUuid}-${requestTypeAcronym}`;
      const fileName = `${dagName}.yaml`;
      const filePath = path.join(DAG_DIR, fileName);
      
      // Check if file exists
      const exists = await fileManager.fileExists(filePath);
      if (!exists) {
        throw new DAGNotFoundError(`DAG with name ${dagName} not found`);
      }
      
      // Generate YAML content with the DAG name
      const yamlContent = yamlGenerator.generateDAGYAML(dagData, dagName);
      
      // Write file
      await fileManager.writeFile(filePath, yamlContent);
      
      return {
        contract_uuid: contractUuid,
        file_path: filePath,
        dag_name: dagName
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete a DAG file
   */
  async deleteDAG(contractUuid, requestType) {
    try {
      const requestTypeAcronym = this.getRequestTypeAcronym(requestType);
      const dagName = `${contractUuid}-${requestTypeAcronym}`;
      const fileName = `${dagName}.yaml`;
      const filePath = path.join(DAG_DIR, fileName);
      
      const exists = await fileManager.fileExists(filePath);
      if (!exists) {
        throw new DAGNotFoundError(`DAG with name ${dagName} not found`);
      }
      
      await fileManager.deleteFile(filePath);
      
      return {
        contract_uuid: contractUuid,
        dag_name: dagName,
        deleted: true
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get acronym for request type
   */
  getRequestTypeAcronym(requestType) {
    const acronymMap = {
      'generate_invoice': 'gi',
      'seat_license': 'sl',
      'seat_license_daily': 'sd'
    };
    
    const acronym = acronymMap[requestType];
    if (!acronym) {
      throw new DAGValidationError(`Unknown request type: ${requestType}`);
    }
    
    return acronym;
  }

  /**
   * Validate DAG data
   */
  validateDAGData(dagData) {
    const validWidgetCadenceRequestTypes = ['seat_license_daily', 'seat_license'];
    
    const requiredWidgetCadenceFields = [
      'contract_uuid',
      'request_type',
      'organization_uuid',
      'customer_id',
      'sku_id',
      'widget_uuid',
      'requestor_uuid',
      'tenant_uuid'
    ];
    const validInvoiceRequestTypes = ['generate_invoice'];
    const requiredInvoiceFields = [
      'contract_uuid',
      'request_type',
      'organization_uuid',
      'customer_id',
      'requestor_uuid',
      'tenant_uuid'
    ];
    

    if (validInvoiceRequestTypes.includes(dagData.request_type)) {
      for (const field of requiredInvoiceFields) {
        if (!dagData[field]) {
          throw new DAGValidationError(`Missing required field for invoice_generation request: ${field}`);
        }
      }
    } else if (validWidgetCadenceRequestTypes.includes(dagData.request_type)) {
      for (const field of requiredWidgetCadenceFields) {
        if (!dagData[field]) {
          throw new DAGValidationError(`Missing required field for widget_cadence request: ${field}`);
        }
      }
    } else {
      throw new DAGValidationError(`Invalid request_type. Must be one of: ${validWidgetCadenceRequestTypes.join(', ')} for widget cadence requests or must be one of: ${validInvoiceRequestTypes.join(', ')} for invoice requests. Got: ${dagData.request_type}`);
    }

    // Validate UUID format (basic validation)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(dagData.contract_uuid)) {
      throw new DAGValidationError('Invalid contract_uuid format');
    }
  }
}

module.exports = new DAGService();
