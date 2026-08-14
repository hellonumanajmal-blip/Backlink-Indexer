# Workflow Platform API Specification

## Base URL
`/api/workflows`

## Endpoints

### 1. Create Workflow Definition
- **POST** `/api/workflows`
- **Headers**: `X-Tenant-ID: <tenant_id>`
- **Request Body**: `WorkflowCreate`
- **Response**: `201 Created` - `WorkflowResponse`

### 2. List Tenant Workflows
- **GET** `/api/workflows`
- **Headers**: `X-Tenant-ID: <tenant_id>`
- **Response**: `200 OK` - List of `WorkflowResponse`

### 3. Get Workflow Details
- **GET** `/api/workflows/{workflow_id}`
- **Headers**: `X-Tenant-ID: <tenant_id>`
- **Response**: `200 OK` - `WorkflowResponse`

### 4. Execute Workflow
- **POST** `/api/workflows/{workflow_id}/execute`
- **Headers**: `X-Tenant-ID: <tenant_id>`
- **Request Body**: `{ "status": "Pending", "domain_authority": 70 }`
- **Response**: `200 OK` - `WorkflowExecutionResponse`

### 5. Dispatch System Event
- **POST** `/api/workflows/events`
- **Headers**: `X-Tenant-ID: <tenant_id>`
- **Request Body**: `WorkflowEventCreate`
- **Response**: `200 OK` - `WorkflowEventResponse`

### 6. Simulate Workflow
- **POST** `/api/workflows/simulate`
- **Request Body**: `SimulationRequest`
- **Response**: `200 OK` - `SimulationResponse`

### 7. List Execution History
- **GET** `/api/workflows/executions`
- **Headers**: `X-Tenant-ID: <tenant_id>`
- **Query Params**: `workflow_id` (optional)
- **Response**: `200 OK` - List of `WorkflowExecutionResponse`

### 8. List Templates
- **GET** `/api/workflows/templates`
- **Response**: `200 OK` - List of `WorkflowTemplateResponse`

### 9. List Execution Failures
- **GET** `/api/workflows/failures`
- **Headers**: `X-Tenant-ID: <tenant_id>`
- **Response**: `200 OK` - List of failures
