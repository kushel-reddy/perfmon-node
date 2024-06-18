# Linux Performance Metric Dashboard API

This project is a Node.js backend API for fetching Linux performance metrics. It serves as the backend for the Linux Performance Metric Dashboard built with React. The API provides endpoints to retrieve real-time and historical performance metrics.

## Features

- Fetch real-time performance metrics.
- Retrieve metrics within a specific date and time range.
- Efficient querying and data transformation.
- Integration with a frontend React dashboard.

## Technologies Used

- Node.js
- Express.js (for creating the server)
- ClickHouse (for database)
- Moment.js (for date and time manipulation)
- Socket.IO (for real-time communication)
- CORS (for handling cross-origin requests)

## Installation

1. Clone the repository:
    ```bash
    git clone https://github.com/kushel-reddy/perfmon-node.git
    ```

2. Navigate to the project directory:
    ```bash
    cd perfmon-node
    ```

3. Install the dependencies:
    ```bash
    npm install
    ```

## Usage

1. Set up your environment variables. Create a `.env` file in the root directory and add the following:
    ```
    PORT=5000
    CLICKHOUSE_URL=http://your-clickhouse-server:8123
    ```

2. Start the server:
    ```bash
    npm start
    ```

3. The API will be running at:
    ```
    http://localhost:5000
    ```

## Endpoints

### GET /api/metrics

Fetch performance metrics within a specific date and time range.

#### Request

```http
GET /api/metrics?start=<start-timestamp>&end=<end-timestamp>&metric=<metric>
