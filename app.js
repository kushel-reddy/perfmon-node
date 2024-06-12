const express = require('express');
const app = express();
const port = 3000;
const { createClient } = require('@clickhouse/client');

const clickhouse = createClient({
  url: 'http://localhost:8123',
  username: 'default', 
  password: '', 
  database: 'default', 
});


app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/query', async (req, res) => {
  try {
    const query = 'SELECT * FROM pidstat_data LIMIT 10'; 
    const result = await clickhouse.query({
      query: query,
      format: 'JSONEachRow',
    })
    const dataset = await result.json()
    res.json(dataset);
  } catch (error) {
    console.error('Error querying ClickHouse:', error);
    res.status(500).send('Error querying ClickHouse');
  }
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
