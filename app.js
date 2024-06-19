const { createClient } = require('@clickhouse/client');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
var moment = require('moment');

const bodyParser = require('body-parser')


const app = express();
const server = http.createServer(app);


app.use(bodyParser.json()) // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded
const corsOptions = {
  origin: ['http://106.216.195.220:3000','http://localhost:3000', 'http://localhost:3001', 'http://13.201.187.39'],
  optionsSuccessStatus: 200,
};
const io = new Server(server, {
  cors: {
    origin: ['http://106.216.195.220:3000','http://localhost:3000', 'http://localhost:3001', 'http://13.201.187.39'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }
});
const port = 3000;

const clickhouse = createClient({
  url: 'http://ec2-13-233-250-35.ap-south-1.compute.amazonaws.com:8123',
  username: 'default',
  password: '',
  database: 'default',
});

app.use(cors(corsOptions));

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

app.post('/metrics', async (req, res) => {
  console.log("req", req.body);
  const { start, end, metrics } = req.body;
  if (!start || !end) {
    return res.status(400).send('Missing start or end query parameters.');
  }

  const validMetrics = ['usr', 'system', 'guest', 'wait', 'CPU'];
  if (!metrics || !metrics.every(metric => validMetrics.includes(metric))) {
    return res.status(400).send('Invalid or missing metric query parameter.');
  }

  const startTimestamp = Math.floor(new Date(start).getTime() / 1000);
  const endTimestamp = Math.floor(new Date(end).getTime() / 1000);

  const queries = metrics.map(metric => `
    SELECT 
      Command, 
      toStartOfMinute(timestamp) AS interval, 
      avg(${metric}) AS ${metric} 
    FROM 
      pidstat_data 
    WHERE 
      toUnixTimestamp(timestamp) >= ${startTimestamp} 
      AND toUnixTimestamp(timestamp) <= ${endTimestamp} 
    GROUP BY 
      Command, toStartOfMinute(timestamp) 
    ORDER BY 
      toStartOfMinute(timestamp)
  `);

  try {
    const results = await Promise.all(queries.map(query => clickhouse.query({
      query: query,
      format: 'JSONEachRow',
    }).then(response => response.json())));

    // Organize the dataset by intervals and metrics
    const dataset = results.reduce((acc, curr, index) => {
      const metric = metrics[index];
      curr.forEach(row => {
        const key = `${row.Command}_${row.interval}`;
        if (!acc[key]) {
          acc[key] = { Command: row.Command, interval: row.interval };
        }
        acc[key][metric] = row[metric];
      });
      return acc;
    }, {});

    // Convert the object to an array
    const responseArray = Object.values(dataset);

    res.json(responseArray);
  } catch (error) {
    res.status(500).send('Error querying ClickHouse: ' + error.message);
  }
});



server.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
