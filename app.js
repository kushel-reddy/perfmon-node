const { createClient } = require('@clickhouse/client');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
var moment = require('moment');


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }
});
const port = 3000;

const clickhouse = createClient({
  // url: 'http://localhost:8123',
  url: 'http://ec2-13-233-250-35.ap-south-1.compute.amazonaws.com:8123',
  username: 'default',
  password: '',
  database: 'default',
});

app.use(cors({
  origin: 'http://localhost:3001'
}));

app.get('/', (req, res) => {
  res.send('Hello World!');
});

const fetchMetricsSince = async (startTime) => {
  const query = `
      SELECT 
          toUnixTimestamp(timestamp) AS interval,
          CPU, system, usr, wait, guest, Command
      FROM 
          pidstat_data 
      WHERE 
          toUnixTimestamp(timestamp) > ${startTime} 
      ORDER BY toUnixTimestamp(timestamp) ASC
  `;
  const rows = await clickhouse.query({
    query: query,
    format: 'JSONEachRow',
  });
  const dataset = await rows.json();
  return dataset;
};


io.on('connection', (socket) => {
  console.log('New client connected');
  let startTime = moment().unix();

  const fetchInitialMetrics = async () => {
    const initialMetrics = await fetchMetricsSince(startTime);
    socket.emit('metrics', initialMetrics);
  };

  fetchInitialMetrics();

  const intervalId = setInterval(async () => {
    const newMetrics = await fetchMetricsSince(startTime);
    if (newMetrics.length > 0) {
      socket.emit('metrics', newMetrics);
      startTime = moment(newMetrics[newMetrics.length - 1].timestamp).unix();
    }
  }, 1000);

  socket.on('disconnect', () => {
    clearInterval(intervalId);
    console.log('Client disconnected');
  });
});


app.get('/metrics', async (req, res) => {
  const { start, end, metric } = req.query;
  if (!start || !end) {
    return res.status(400).send('Missing start or end query parameters.');
  }

  const validMetrics = ['usr', 'system', 'guest', 'wait', 'CPU'];
  if (!metric || !validMetrics.includes(metric)) {
    return res.status(400).send('Invalid or missing metric query parameter.');
  }

  const startTimestamp = Math.floor(new Date(start).getTime() / 1000);
  const endTimestamp = Math.floor(new Date(end).getTime() / 1000);

  const query = `
  SELECT 
    Command,
    toStartOfMinute(timestamp) AS interval,
    avg(${metric}) AS ${metric}
  FROM pidstat_data
  WHERE toUnixTimestamp(timestamp) >= ${startTimestamp} 
    AND toUnixTimestamp(timestamp) <= ${endTimestamp}
  GROUP BY Command, toStartOfMinute(timestamp)
  ORDER BY Command, toStartOfMinute(timestamp)
  `;

  try {
    const rows = await clickhouse.query({
      query: query,
      format: 'JSONEachRow',
    });
    const dataset = await rows.json()
    res.json(dataset);
  } catch (error) {
    res.status(500).send('Error querying ClickHouse: ' + error.message);
  }
});

server.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
