const { exec } = require('child_process');

function killNodeProcesses() {
    return new Promise((resolve) => {
        const currentPid = process.pid;
        console.log('Current PID:', currentPid);

        // First, list all Node processes
        exec('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH', (error, stdout, stderr) => {
            if (error) {
                console.error('Error listing processes:', error);
                resolve(false);
                return;
            }

            // Parse the CSV output
            const processes = stdout.split('\n')
                .filter(line => line.trim())
                .map(line => {
                    try {
                        // CSV format: "node.exe","1234","Console","1","67,892 K"
                        const parts = line.split(',');
                        return parseInt(parts[1].replace(/"/g, ''));
                    } catch (e) {
                        console.error('Error parsing process line:', line);
                        return null;
                    }
                })
                .filter(pid => pid && pid !== currentPid); // Remove current process and invalid PIDs

            if (processes.length === 0) {
                console.log('No other Node processes found.');
                resolve(true);
                return;
            }

            console.log('Found Node processes:', processes);

            // Kill each process individually
            let killed = 0;
            processes.forEach(pid => {
                exec(`taskkill /F /PID ${pid}`, (error, stdout, stderr) => {
                    killed++;
                    if (error) {
                        console.error(`Error killing process ${pid}:`, error);
                    } else {
                        console.log(`Successfully killed process ${pid}`);
                    }
                    
                    if (killed === processes.length) {
                        console.log('All processes handled.');
                        // Wait a bit before resolving
                        setTimeout(() => resolve(true), 500);
                    }
                });
            });
        });
    });
}

// Run the cleanup
killNodeProcesses().then(() => {
    console.log('Cleanup completed');
    process.exit(0);
}).catch(error => {
    console.error('Cleanup failed:', error);
    process.exit(1);
});
