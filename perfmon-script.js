const { exec } = require('child_process');
const { ClickHouse } = require('clickhouse');
const moment = require('moment');

const clickhouse = new ClickHouse({
    url: 'http://172.31.43.109:8143',
    basicAuth: {
        username: 'default',
        password: '',
    },
    isUseGzip: false,
    format: "json",
    config: {
        session_timeout: 60,
        output_format_json_quote_64bit_integers: 0,
        enable_http_compression: 0
    },
});


const createTableQuery = `
CREATE TABLE IF NOT EXISTS pidstat_data (
    datetime DateTime,
    UID String,
    PID String,
    usr Float64,
    system Float64,
    guest Float64,
    wait Float64,
    CPU Float64,
    Command String
) ENGINE = MergeTree()
ORDER BY datetime;
`;

clickhouse.query(createTableQuery).toPromise().then(() => {
    console.log('Table created or already exists.');
}).catch(err => {
    console.error('Error creating table:', err);
});


const runPidstat = () => {
    return new Promise((resolve, reject) => {
        exec('pidstat -u 1 10', (error, stdout, stderr) => {
            if (error) {
                reject(`exec error: ${error}`);
                return;
            }
            resolve(stdout);
        });
    });
};


const parsePidstatOutput = (output) => {
    const lines = output.trim().split('\n');
    const data = [];
    const startIndex = 3;
    const currentDate = moment().format('YYYY-MM-DD');

    for (let i = startIndex; i < lines.length; i++) {
        const fields = lines[i].trim().split(/\s+/);
        if (fields.length > 0 && fields[1] !== 'UID' && fields[0] !== 'Average:' && fields[0] !== '') {
            console.log(fields[0])
            const time = fields[0];
            const uid = fields[1];
            const pid = fields[2];
            const usr = parseFloat(fields[3]);
            const system = parseFloat(fields[4]);
            const guest = parseFloat(fields[5]);
            const wait = parseFloat(fields[6]);
            const cpu = parseFloat(fields[7]);
            const command = fields[8];

            data.push({
                datetime: `${currentDate}`,
                UID: uid,
                PID: pid,
                usr: usr,
                system: system,
                guest: guest,
                wait: wait,
                CPU: cpu,
                Command: command
            });
        }
    }
    return data;
};

// Function to insert data into ClickHouse
const insertDataIntoClickhouse = async (data) => {
    try {
        console.log("Preparing to insert data into ClickHouse");
        const query = `
        INSERT INTO pidstat_data (datetime, UID, PID, usr, system, guest, wait, CPU, Command) 
        VALUES 
        `;
        const values = data.map(entry => `(
            '${entry.datetime}', 
            '${entry.UID}', 
            '${entry.PID}', 
            ${entry.usr}, 
            ${entry.system}, 
            ${entry.guest}, 
            ${entry.wait}, 
            ${entry.CPU}, 
            '${entry.Command}'
        )`).join(',');

        await clickhouse.query(query + values).toPromise();
        console.log("Data inserted successfully");
    } catch (e) {
        console.error(`An error occurred during data insertion: ${e}`);
        throw e;
    }
};


const main = async () => {
    try {
        const pidstatOutput = await runPidstat();
        console.log(pidstatOutput)
        const parsedMetrics = parsePidstatOutput(pidstatOutput);
        await insertDataIntoClickhouse(parsedMetrics);
        console.log(parsedMetrics);
    } catch (e) {
        console.error(`Failed to insert data: ${e}`);
    }
};

main();
