const { networkInterfaces } = require('os');

const nets = networkInterfaces();
const results = {};

for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
        // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
        if (net.family === 'IPv4' && !net.internal) {
            if (!results[name]) {
                results[name] = [];
            }
            results[name].push(net.address);
        }
    }
}

console.log('Your local IP addresses:');
console.log(JSON.stringify(results, null, 2));
